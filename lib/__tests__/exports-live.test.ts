/**
 * Live export check against the real database: renders every signed-off record in every format,
 * exactly as the download routes do. Skipped unless EXPORT_LIVE=1 (npm run exports:check).
 * Prints status, size and timing only — never record content — and records no exports.
 */
import { describe, expect, it } from 'vitest';

const live = process.env.EXPORT_LIVE === '1';
if (live) {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    /* rely on the environment */
  }
}

describe.skipIf(!live)('live exports (EXPORT_LIVE=1)', () => {
  it('renders every signed-off record in PDF, Word and slides', async () => {
    const { eq } = await import('drizzle-orm');
    const { getDb, schema } = await import('@/db');
    const { buildExportDoc } = await import('@/lib/exports/data');
    const { renderExport } = await import('@/lib/exports/render');
    type Fmt = 'pdf' | 'docx' | 'pptx';

    const finals = await getDb()
      .select({ id: schema.encounter.id, orgId: schema.encounter.orgId, workerId: schema.encounter.workerId })
      .from(schema.encounter)
      .where(eq(schema.encounter.status, 'final'));
    const failures: string[] = [];

    const check = async (label: string, fn: () => Promise<Buffer>) => {
      const t0 = Date.now();
      try {
        const buf = await fn();
        const ok = buf.length > 1000 && (buf.subarray(0, 4).toString() === '%PDF' || buf.subarray(0, 2).toString() === 'PK');
        if (!ok) failures.push(`${label}: bad file`);
        console.log(`  ${ok ? 'OK  ' : 'BAD '} ${label.padEnd(44)} ${String(buf.length).padStart(8)} bytes  ${Date.now() - t0} ms`);
      } catch (err) {
        const e = err as Error;
        failures.push(`${label}: ${e.name}: ${e.message}`);
        console.log(`  FAIL ${label.padEnd(44)} ${e.name}: ${e.message.slice(0, 200)}\n${e.stack?.split('\n').slice(1, 7).join('\n')}`);
      }
    };

    for (const f of finals) {
      const ctx = { userId: f.workerId, orgId: f.orgId, role: 'admin' as const };
      for (const format of ['pdf', 'docx', 'pptx'] as Fmt[]) {
        await check(`${f.id.slice(-9)} ${format}`, async () => {
          const doc = await buildExportDoc(ctx, { encounterIds: [f.id] }, { lang: 'eng', watermark: false, includeOriginals: format !== 'pptx' });
          if (format === 'pptx') doc.aggregate = true;
          return renderExport(doc, format);
        });
      }
      await check(`${f.id.slice(-9)} pdf (Kiswahili, trial mark)`, async () => renderExport(await buildExportDoc(ctx, { encounterIds: [f.id] }, { lang: 'swa', watermark: true }), 'pdf'));
    }
    if (finals.length) {
      const ctx = { userId: finals[0].workerId, orgId: finals[0].orgId, role: 'admin' as const };
      for (const format of ['pdf', 'docx', 'pptx'] as Fmt[]) {
        await check(`all signed-off records ${format}`, async () => {
          const doc = await buildExportDoc(ctx, { filter: {} }, { lang: 'eng', watermark: false });
          doc.aggregate = true;
          return renderExport(doc, format);
        });
      }
    }
    console.log(`${finals.length} signed-off record(s) checked; ${failures.length} failure(s).`);
    expect(failures).toEqual([]);
  }, 300_000);
});
