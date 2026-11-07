/**
 * Re-runs processing for records stuck in "Processing" (status only is printed, never content).
 *
 * Usage: npm run jobs:retry -- [encounterId ...]
 * With no ids, every encounter in 'processing' for more than 2 minutes is retried.
 * Everything runs in this process, including the follow-on steps, never through Inngest.
 */
delete process.env.INNGEST_EVENT_KEY;
delete process.env.INNGEST_DEV;

import { and, eq, inArray, lt } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { runNow } from '../lib/jobs/dispatch';

async function main() {
  const db = getDb();
  const ids = process.argv.slice(2);
  const stuck = ids.length
    ? await db.select().from(schema.encounter).where(inArray(schema.encounter.id, ids))
    : await db
        .select()
        .from(schema.encounter)
        .where(and(eq(schema.encounter.status, 'processing'), lt(schema.encounter.updatedAt, new Date(Date.now() - 2 * 60_000))));
  if (!stuck.length) return console.log('No stuck records.');

  for (const enc of stuck) {
    const sources = await db.select().from(schema.source).where(eq(schema.source.encounterId, enc.id));
    const unfinished = sources.filter((s) => s.status === 'pending' || s.status === 'processing');
    for (const s of unfinished) {
      await runNow({ name: s.kind === 'audio' ? 'source/transcribe.requested' : 'source/extract.requested', data: { sourceId: s.id } });
    }
    if (!unfinished.length) await runNow({ name: 'encounter/refine.requested', data: { encounterId: enc.id } });
    const [after] = await db.select({ status: schema.encounter.status }).from(schema.encounter).where(eq(schema.encounter.id, enc.id));
    const srcAfter = await db.select({ kind: schema.source.kind, status: schema.source.status, error: schema.source.error }).from(schema.source).where(eq(schema.source.encounterId, enc.id));
    console.log(`${enc.id}: ${enc.status} -> ${after?.status}`, JSON.stringify(srcAfter));
  }
}

main().catch((err) => {
  console.error('failed:', err instanceof Error ? `${err.name}: ${err.message}` : err);
  process.exit(1);
});
