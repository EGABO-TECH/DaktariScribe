/**
 * Renders every signed-off record in every export format exactly as the download routes do, and
 * reports success, size and timing (or the error). Nothing is saved, logged as an export, or
 * printed from the records themselves.
 *
 *   npm run exports:check
 */
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import { buildExportDoc } from '../lib/exports/data';
import { renderExport, type ExportFormat } from '../lib/exports/render';
import type { AuthContext } from '../lib/auth';

async function main() {
  const finals = await getDb()
    .select({ id: schema.encounter.id, orgId: schema.encounter.orgId, workerId: schema.encounter.workerId })
    .from(schema.encounter)
    .where(eq(schema.encounter.status, 'final'));
  if (!finals.length) return console.log('No signed-off records to export.');

  let failures = 0;
  const check = async (label: string, fn: () => Promise<Buffer>) => {
    const t0 = Date.now();
    try {
      const buf = await fn();
      const ok = buf.length > 1000 && (buf.subarray(0, 4).toString() === '%PDF' || buf.subarray(0, 2).toString() === 'PK');
      if (!ok) failures++;
      console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label.padEnd(30)} ${String(buf.length).padStart(8)} bytes  ${Date.now() - t0} ms`);
    } catch (err) {
      failures++;
      const e = err as Error;
      console.log(`  FAIL ${label.padEnd(30)} ${e.name}: ${e.message.slice(0, 160)}`);
      if (process.env.STACK) console.log(e.stack?.split('\n').slice(0, 8).join('\n'));
    }
  };

  for (const f of finals) {
    // The author, as an admin of the record's workspace, so the scope check passes.
    const ctx: AuthContext = { userId: f.workerId, orgId: f.orgId, role: 'admin' };
    console.log(`${f.id}`);
    for (const format of ['pdf', 'docx', 'pptx'] as ExportFormat[]) {
      await check(`single ${format}`, async () => {
        const doc = await buildExportDoc(ctx, { encounterIds: [f.id] }, { lang: 'eng', watermark: false, includeOriginals: format !== 'pptx' });
        if (format === 'pptx') doc.aggregate = true;
        return renderExport(doc, format);
      });
    }
    await check('single pdf, Kiswahili', async () => renderExport(await buildExportDoc(ctx, { encounterIds: [f.id] }, { lang: 'swa', watermark: true }), 'pdf'));
  }
  const ctx: AuthContext = { userId: finals[0].workerId, orgId: finals[0].orgId, role: 'admin' };
  console.log('All signed-off records (Insights deck / report)');
  for (const format of ['pdf', 'docx', 'pptx'] as ExportFormat[]) {
    await check(`aggregate ${format}`, async () => {
      const doc = await buildExportDoc(ctx, { filter: {} }, { lang: 'eng', watermark: false });
      doc.aggregate = true;
      return renderExport(doc, format);
    });
  }
  console.log(failures ? `\n${failures} export(s) failed.` : '\nAll exports rendered.');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('check failed:', err instanceof Error ? `${err.name}: ${err.message}` : err);
  process.exit(1);
});
