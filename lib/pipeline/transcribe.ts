/**
 * Transcription job for an audio source (spec §3b). Server only.
 *
 * Router: English (and French) → AssemblyAI; other supported languages → Sunbird.
 * Fallback: if the primary engine fails, try the other (Sunbird also supports English).
 * Each recording segment (file) is transcribed separately and stitched with time offsets.
 * Silent/empty segments are skipped and repeated phrases collapsed (lib/stt/guard).
 * The engine that produced each segment is recorded.
 */
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { RATES_USD_MICROS } from '@/lib/billing/rates';
import { recordUsage } from '@/lib/billing/usage';
import { encryptJson, encryptString } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { assemblyAi } from '@/lib/stt/assemblyai';
import { buildTranscript, guardSegments } from '@/lib/stt/guard';
import { AudioTrimmedError, type SttEngine, type TranscriptSegment } from '@/lib/stt/types';
import { sunbirdStt } from '@/lib/sunbird/stt';
import { readFile, receivedParts } from '@/lib/storage';
import { continueToRefine } from './sources';

/** Files this small are silence or a failed recorder start; skip them (simple VAD). */
const MIN_AUDIO_BYTES = 3_000;

/** Recording parts sent to the speech service at once. */
const TRANSCRIBE_CONCURRENCY = 3;

/** Maps with at most `limit` calls in flight; results keep input order. Rejects on the first failure. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export class NoSpeechEngineError extends Error {
  constructor() {
    super('No speech-to-text service is configured for this language (set ASSEMBLYAI_API_KEY or SUNBIRD_USERNAME/PASSWORD).');
    this.name = 'NoSpeechEngineError';
  }
}

export function enginesFor(language: string): SttEngine[] {
  const primary = language === 'eng' || language === 'fra' ? [assemblyAi, sunbirdStt] : [sunbirdStt, assemblyAi];
  return primary.filter((e) => e.configured() && e.supports(language));
}

export async function runTranscription(sourceId: string, opts: { rethrow?: boolean } = {}) {
  const db = getDb();
  const [src] = await db.select().from(schema.source).where(eq(schema.source.id, sourceId)).limit(1);
  if (!src || src.kind !== 'audio' || src.status === 'ready') return;
  const [enc] = await db.select().from(schema.encounter).where(eq(schema.encounter.id, src.encounterId)).limit(1);
  const language = src.language ?? enc.interviewLanguage;
  const engines = enginesFor(language);
  if (!engines.length) {
    await db
      .update(schema.source)
      .set({ status: 'failed', error: 'Transcription is not available for this language yet. The recording is kept.' })
      .where(eq(schema.source.id, sourceId));
    await continueToRefine(src.encounterId);
    return;
  }

  await db.update(schema.source).set({ status: 'processing' }).where(eq(schema.source.id, sourceId));
  const parts = await receivedParts(sourceId);
  const all: TranscriptSegment[] = [];
  const enginesUsed: string[] = [];
  let offset = 0;
  let skipped = 0;
  const seconds: Record<string, number> = { assemblyai: 0, sunbird: 0 };

  /** Transcribes one recording part with engine fallback; null = silent part, skipped. */
  const transcribeFile = async (file: number) => {
    const audio = await readFile(sourceId, file, parts.get(file)?.length ?? 0);
    if (audio.length < MIN_AUDIO_BYTES) return null;
    let lastErr: unknown;
    for (const engine of engines) {
      try {
        return { engine: engine.name, result: await engine.transcribe(audio, src.mimeType ?? 'audio/webm', language) };
      } catch (err) {
        lastErr = err;
        logger.warn('transcribe.engine_failed', { sourceId, file, engine: engine.name, trimmed: err instanceof AudioTrimmedError, err });
      }
    }
    throw lastErr ?? new Error('Transcription failed');
  };

  try {
    // Parts are transcribed in parallel (a few at a time), then stitched in order with offsets.
    const results = await mapLimit(
      Array.from({ length: src.fileCount }, (_, i) => i),
      TRANSCRIBE_CONCURRENCY,
      transcribeFile,
    );
    results.forEach((r, file) => {
      if (!r) {
        skipped++;
        enginesUsed.push('skipped');
        return;
      }
      for (const s of r.result.segments) all.push({ ...s, start: s.start + offset, end: s.end + offset, file, fileOffset: offset });
      offset += r.result.durationSec;
      seconds[r.engine] += r.result.durationSec;
      enginesUsed.push(r.engine);
    });
  } catch (err) {
    if (opts.rethrow) throw err;
    await db.update(schema.source).set({ status: 'failed', error: 'Transcription failed. The recording is kept; try Re-process later.' }).where(eq(schema.source.id, sourceId));
    await continueToRefine(src.encounterId);
    return;
  }

  const guarded = guardSegments(all);
  const report = guarded.report;
  const { text, segments } = buildTranscript(guarded.segments);
  await db
    .update(schema.source)
    .set({
      status: 'ready',
      error: null,
      rawText: encryptString(text),
      segments: encryptJson(segments),
      engine: (enginesUsed.find((e) => e !== 'skipped') as 'assemblyai' | 'sunbird' | undefined) ?? null,
      durationSec: offset,
      meta: { enginesPerFile: enginesUsed, silentFilesSkipped: skipped, ...report, singleSpeaker: !segments.some((s) => s.speaker) },
    })
    .where(eq(schema.source.id, sourceId));

  for (const [engine, secs] of Object.entries(seconds)) {
    if (!secs) continue;
    await recordUsage({
      orgId: enc.orgId,
      userId: enc.workerId,
      kind: 'audio_seconds',
      quantity: secs,
      costUsdMicros: secs * (engine === 'assemblyai' ? RATES_USD_MICROS.assemblyaiPerSecond : RATES_USD_MICROS.sunbirdPerSecond),
      encounterId: enc.id,
    });
  }
  const { addVoiceSeconds } = await import('@/lib/billing/entitlements');
  await addVoiceSeconds(enc.workerId, enc.orgId, Math.round(offset));
  await continueToRefine(src.encounterId);
}
