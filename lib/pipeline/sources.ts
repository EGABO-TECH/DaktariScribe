/** Shared helpers for source processing jobs. Server only. */
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { logger } from '@/lib/logger';

export async function markSourceFailed(sourceId: string, message = 'This file could not be processed. Its original is kept.') {
  const db = getDb();
  const [src] = await db.update(schema.source).set({ status: 'failed', error: message }).where(eq(schema.source.id, sourceId)).returning();
  if (src) await continueToRefine(src.encounterId);
}

/**
 * When every source of an encounter has finished (ready or failed), move on to refinement.
 * Called from inside jobs, so it runs refinement directly (or hands it to Inngest).
 */
export async function continueToRefine(encounterId: string) {
  const db = getDb();
  const rows = await db.select({ status: schema.source.status }).from(schema.source).where(eq(schema.source.encounterId, encounterId));
  if (rows.some((r) => r.status === 'pending' || r.status === 'processing' || r.status === 'pending_upload')) return;
  const { inngestEnabled } = await import('@/lib/jobs/dispatch');
  if (inngestEnabled()) {
    const { inngest } = await import('@/lib/jobs/inngest');
    await inngest.send({ name: 'encounter/refine.requested', data: { encounterId } });
    return;
  }
  const { runRefinement, finishWithOriginal } = await import('./refine');
  try {
    await runRefinement(encounterId);
  } catch (err) {
    logger.error('refine.after_sources_failed', { encounterId, err });
    await finishWithOriginal(encounterId);
  }
}
