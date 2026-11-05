/**
 * Sunbird speech-to-text (spec §3b), verified against docs.sunbird.ai (Nov 2026):
 * POST /tasks/audio/transcriptions, multipart with ONLY `audio`, `language` (ISO 639-3,
 * required) and `timestamps`. Other fields return 422 since v2.1.
 * Response: audio_transcription, segments [{start,end,text}] | null, duration_seconds,
 * was_audio_trimmed. No speakers or confidence: transcripts are single-speaker.
 */
import { AudioTrimmedError, type SegmentTranscript, type SttEngine } from '@/lib/stt/types';
import { sunbirdConfigured, sunbirdFetch } from './auth';

export const SUNBIRD_STT_LANGUAGES = new Set([
  'ach', 'eng', 'lug', 'nyn', 'swa', 'teo', 'lgg', 'xog', 'myx', 'cgg', 'kin', 'luo', 'alz', 'adh', 'kdi', 'kdj', 'koo', 'ttj', 'rub', 'ruc', 'nyo',
]);

type SunbirdSttResponse = {
  audio_transcription: string;
  duration_seconds?: number;
  segments?: { start: number; end: number; text: string }[] | null;
  was_audio_trimmed?: boolean;
};

export const sunbirdStt: SttEngine = {
  name: 'sunbird',
  configured: sunbirdConfigured,
  supports: (language) => SUNBIRD_STT_LANGUAGES.has(language),
  async transcribe(audio, mimeType, language): Promise<SegmentTranscript> {
    const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
    const res = await sunbirdFetch('/tasks/audio/transcriptions', (token) => {
      const form = new FormData();
      form.append('audio', new Blob([new Uint8Array(audio)], { type: mimeType }), `segment.${ext}`);
      form.append('language', language);
      form.append('timestamps', 'true');
      return { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form };
    });
    if (!res.ok) throw new Error(`Sunbird transcription failed (${res.status}).`);
    const data = (await res.json()) as SunbirdSttResponse;
    if (data.was_audio_trimmed) throw new AudioTrimmedError();
    const duration = data.duration_seconds ?? data.segments?.at(-1)?.end ?? 0;
    const segments = data.segments?.length
      ? data.segments.map((s) => ({ start: s.start, end: s.end, text: s.text.trim(), engine: 'sunbird' as const }))
      : data.audio_transcription
        ? [{ start: 0, end: duration, text: data.audio_transcription.trim(), engine: 'sunbird' as const }]
        : [];
    return { segments, durationSec: duration, engine: 'sunbird' };
  },
};
