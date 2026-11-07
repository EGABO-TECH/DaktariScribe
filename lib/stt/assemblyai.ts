/**
 * AssemblyAI batch transcription (spec §3b). Server only.
 * Verified against the installed `assemblyai` SDK and AssemblyAI docs (Nov 2026):
 *   speech_models ["universal-3-5-pro"], Medical Mode via domain "medical-v1",
 *   speaker_labels, keyterms_prompt.
 */
import { AssemblyAI } from 'assemblyai';
import { keytermsFor } from '@/lib/clinical/keyterms';
import { LOW_CONFIDENCE, type SegmentTranscript, type SttEngine } from './types';

// ISO 639-3 → AssemblyAI language codes for the languages we route to it.
const LANG: Record<string, string> = { eng: 'en', fra: 'fr' };

export const assemblyAi: SttEngine = {
  name: 'assemblyai',
  configured: () => Boolean(process.env.ASSEMBLYAI_API_KEY),
  supports: (language) => language in LANG,
  async transcribe(audio, _mimeType, language): Promise<SegmentTranscript> {
    const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
    const t = await client.transcripts.transcribe(
      {
        audio,
        speech_models: ['universal-3-5-pro'],
        language_code: LANG[language] ?? 'en',
        domain: 'medical-v1',
        speaker_labels: true,
        keyterms_prompt: keytermsFor(language),
      },
      // Check every second (SDK default 3 s) and never wait forever (SDK default): a stuck job
      // fails over to the other engine instead of leaving the record in Processing.
      { pollingInterval: 1000, pollingTimeout: 10 * 60_000 },
    );
    if (t.status === 'error') throw new Error('Transcription failed at the speech service.');
    const segments = (t.utterances ?? []).map((u) => ({
      start: u.start / 1000,
      end: u.end / 1000,
      text: u.text,
      speaker: u.speaker ? `Speaker ${u.speaker}` : undefined,
      confidence: u.confidence,
      lowConfidence: (u.words ?? []).filter((w) => w.confidence < LOW_CONFIDENCE).map((w) => w.text),
      engine: 'assemblyai' as const,
    }));
    if (!segments.length && t.text) {
      segments.push({ start: 0, end: t.audio_duration ?? 0, text: t.text, speaker: undefined, confidence: t.confidence ?? 0, lowConfidence: [], engine: "assemblyai" });
    }
    return { segments, durationSec: t.audio_duration ?? segments.at(-1)?.end ?? 0, engine: 'assemblyai' };
  },
};
