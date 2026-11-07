/**
 * Refinement pipeline for one encounter (spec §5 Phase 2.5). Runs in a background job.
 *
 * 1. Load the encounter's ready sources (decrypted originals).
 * 2. If a text processor is configured: pseudonymise → refine → map to spans → coverage net →
 *    code verification → save as a new version created by 'ai'.
 *    Otherwise (or if processing fails or is declined): save the worker's own text as the
 *    version, untouched, so review and sign-off still work.
 * 3. Status → in_review.
 * Never logs or stores note content outside the encrypted columns.
 */
import { and, eq, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getProcessor, isProcessorConfigured, ProcessingDeclinedError } from '@/lib/ai/provider';
import { buildRefinePrompt, ensureCoverage, toRefinedRecord, type RefineSource } from '@/lib/ai/refine';
import { llmCostMicros } from '@/lib/billing/rates';
import { recordUsage } from '@/lib/billing/usage';
import { decryptOptional, decryptString, encryptJson } from '@/lib/crypto';
import { newId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { recordFromSources, type RefinedRecord } from '@/lib/records/refined-record';
import { templateDefinition } from '@/lib/templates/definition';
import { verifyRecord, type VerificationSummary } from '@/lib/verify';
import { flagUnclearAudio, uncertainRanges } from '@/lib/verify/audio';
import { decryptJson } from '@/lib/crypto';

const { encounter, source, refinedVersion, template } = schema;

export type RefineOutcome = 'organised' | 'original' | 'skipped';

/**
 * Client errors that retrying can't fix: no credit, bad key, no access, bad request.
 * Timeouts, conflicts and rate limits (408/409/429) and server errors stay retryable.
 */
export function isPermanentProviderError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && ![408, 409, 429].includes(status);
}

export type RefineOptions = {
  /** Who asked (for the usage ledger). Defaults to the author. */
  requestedBy?: string;
  /** Skip the processor and use the original text (used after retries are exhausted). */
  forceOriginal?: boolean;
  /** Rethrow processor errors so the job runner can retry. */
  rethrow?: boolean;
};

export async function runRefinement(encounterId: string, opts: RefineOptions = {}): Promise<RefineOutcome> {
  const db = getDb();
  const [enc] = await db.select().from(encounter).where(eq(encounter.id, encounterId)).limit(1);
  if (!enc || enc.status === 'final') return 'skipped';

  const srcRows = await db.select().from(source).where(eq(source.encounterId, enc.id)).orderBy(source.createdAt);
  if (srcRows.some((s) => s.status === 'pending' || s.status === 'processing')) {
    // Transcription/extraction still running; their jobs re-request refinement when done.
    return 'skipped';
  }
  const sources: RefineSource[] = srcRows
    .filter((s) => s.status === 'ready' && s.rawText)
    .map((s) => ({ id: s.id, text: decryptString(s.rawText!) }))
    .filter((s) => s.text.trim().length > 0);

  const [tpl] = await db.select().from(template).where(eq(template.id, enc.templateId)).limit(1);
  const def = templateDefinition.parse(tpl.definition);

  let content: RefinedRecord;
  let createdBy = enc.workerId;
  let verification: (VerificationSummary & { mode: string }) | { mode: string; reason?: string };

  if (!sources.length) {
    content = recordFromSources([], def);
    verification = { mode: 'original', reason: 'no_text' };
  } else if (!isProcessorConfigured() || opts.forceOriginal) {
    content = recordFromSources(sources, def);
    verification = { mode: 'original', reason: opts.forceOriginal ? 'failed' : 'processor_not_configured' };
  } else {
    try {
      const processor = await getProcessor();
      const respondentRef = decryptOptional(enc.respondentRef);
      const prompt = buildRefinePrompt(sources, def, respondentRef);
      const { output, usage } = await processor.refine({ system: prompt.system, user: prompt.user });
      await recordUsage({
        orgId: enc.orgId,
        userId: opts.requestedBy ?? enc.workerId,
        kind: 'llm_tokens',
        quantity: usage.inputTokens + usage.outputTokens,
        costUsdMicros: llmCostMicros(usage.model, usage.inputTokens, usage.outputTokens),
        encounterId: enc.id,
      });
      const mapped = ensureCoverage(toRefinedRecord(output, { sentences: prompt.sentences, sources, def, map: prompt.map }), prompt.sentences);
      const fields = def.sections.flatMap((s) => s.fields);
      const result = verifyRecord({ sources, record: mapped, fields });
      // Words heard with low confidence mark the lines that use them (non-blocking).
      const ranges = srcRows
        .filter((s) => s.kind === 'audio' && s.segments)
        .flatMap((s) => uncertainRanges(s.id, decryptJson<{ charStart?: number; charEnd?: number; lowConfidence?: string[] }[]>(s.segments!)));
      content = flagUnclearAudio(result.record, ranges);
      createdBy = 'ai';
      verification = { ...result.summary, mode: 'organised' };
    } catch (err) {
      const declined = err instanceof ProcessingDeclinedError;
      const permanent = isPermanentProviderError(err);
      logger.error('refine.processor_failed', { encounterId: enc.id, declined, permanent, err });
      if (!declined && !permanent && opts.rethrow) throw err; // let the job runner retry
      content = recordFromSources(sources, def);
      verification = { mode: 'original', reason: err instanceof ProcessingDeclinedError ? 'declined' : 'failed' };
    }
  }

  const [{ maxNo }] = await db
    .select({ maxNo: sql<number>`coalesce(max(${refinedVersion.versionNo}), 0)` })
    .from(refinedVersion)
    .where(eq(refinedVersion.encounterId, enc.id));
  const versionId = newId();
  await db.batch([
    db.insert(refinedVersion).values({
      id: versionId,
      encounterId: enc.id,
      versionNo: Number(maxNo) + 1,
      createdBy,
      content: encryptJson(content),
      verification,
      parentVersionId: enc.currentVersionId,
    }),
    db
      .update(encounter)
      .set({ currentVersionId: versionId, status: 'in_review' })
      .where(and(eq(encounter.id, enc.id), sql`${encounter.status} <> 'final'`)),
  ]);
  logger.info('refine.done', { encounterId: enc.id, mode: verification.mode });
  return verification.mode === 'organised' ? 'organised' : 'original';
}

/** Called when a job gives up after all retries: never leave a record stuck in Processing. */
export async function finishWithOriginal(encounterId: string) {
  try {
    await runRefinement(encounterId, { forceOriginal: true });
  } catch (err) {
    logger.error('refine.fallback_failed', { encounterId, err });
  }
}
