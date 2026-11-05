/**
 * Text extraction for uploaded files (spec §3c). Server only.
 *   DOCX → mammoth (raw text)
 *   XLSX/CSV → SheetJS / papaparse, rows as "Column: value" lines
 *   Text PDF → pdf-parse; scanned PDF or image → transcribe-only OCR via the text processor
 * Extracted text goes into source.rawText and then the same refinement pipeline.
 */
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { getProcessor, isProcessorConfigured } from '@/lib/ai/provider';
import { llmCostMicros } from '@/lib/billing/rates';
import { recordUsage } from '@/lib/billing/usage';
import { encryptJson, encryptString } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { readFile, receivedParts } from '@/lib/storage';
import { continueToRefine } from './sources';

type Extracted = { text: string; pages?: { page: number; text: string }[]; engine: 'parser' | 'llm-ocr' };

export const UPLOAD_TYPES: Record<string, string> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
};

function rowsToLines(rows: Record<string, unknown>[]): string {
  return rows
    .map((r) =>
      Object.entries(r)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
        .map(([k, v]) => `${k.trim()}: ${String(v).trim()}`)
        .join('\n'),
    )
    .filter(Boolean)
    .join('\n\n');
}

export async function extractText(data: Buffer, mimeType: string, ctx: { orgId: string; userId: string; encounterId: string }): Promise<Extracted> {
  const kind = UPLOAD_TYPES[mimeType];
  if (kind === 'docx') {
    const mammoth = await import('mammoth');
    const r = await mammoth.extractRawText({ buffer: data });
    return { text: r.value, engine: 'parser' };
  }
  if (kind === 'xlsx') {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(data, { type: 'buffer' });
    const text = wb.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: '' });
      return wb.SheetNames.length > 1 ? `Sheet: ${name}\n${rowsToLines(rows)}` : rowsToLines(rows);
    }).join('\n\n');
    return { text, engine: 'parser' };
  }
  if (kind === 'csv') {
    const Papa = (await import('papaparse')).default;
    const parsed = Papa.parse<Record<string, unknown>>(data.toString('utf8'), { header: true, skipEmptyLines: true });
    return { text: rowsToLines(parsed.data), engine: 'parser' };
  }
  if (kind === 'pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(data) });
    try {
      const r = await parser.getText();
      const pages = r.pages.map((p) => ({ page: p.num, text: p.text.trim() }));
      const chars = pages.reduce((n, p) => n + p.text.replace(/\s/g, '').length, 0);
      if (chars >= 40 * Math.max(1, pages.length)) {
        return { text: pages.map((p) => p.text).join('\n\n'), pages, engine: 'parser' };
      }
    } finally {
      await parser.destroy();
    }
    // Little or no text layer: a scan. Fall through to OCR.
  }
  if (kind === 'pdf' || kind === 'image') {
    if (!isProcessorConfigured()) throw new Error('OCR_NOT_CONFIGURED');
    const processor = await getProcessor();
    const { output, usage } = await processor.ocr({ data, mediaType: mimeType as 'application/pdf' });
    await recordUsage({
      ...ctx,
      kind: 'llm_tokens',
      quantity: usage.inputTokens + usage.outputTokens,
      costUsdMicros: llmCostMicros(usage.model, usage.inputTokens, usage.outputTokens),
    });
    const pages = output.pages.map((p) => ({ page: p.page, text: p.text }));
    return { text: pages.map((p) => p.text).join('\n\n'), pages, engine: 'llm-ocr' };
  }
  throw new Error('UNSUPPORTED_TYPE');
}

export async function runExtraction(sourceId: string, opts: { rethrow?: boolean } = {}) {
  const db = getDb();
  const [src] = await db.select().from(schema.source).where(eq(schema.source.id, sourceId)).limit(1);
  if (!src || src.kind !== 'upload' || src.status === 'ready') return;
  const [enc] = await db.select().from(schema.encounter).where(eq(schema.encounter.id, src.encounterId)).limit(1);
  await db.update(schema.source).set({ status: 'processing' }).where(eq(schema.source.id, sourceId));
  try {
    const parts = await receivedParts(sourceId);
    const data = await readFile(sourceId, 0, parts.get(0)?.length ?? 0);
    const r = await extractText(data, src.mimeType ?? '', { orgId: enc.orgId, userId: enc.workerId, encounterId: enc.id });
    await db
      .update(schema.source)
      .set({
        status: 'ready',
        error: null,
        rawText: encryptString(r.text),
        segments: r.pages ? encryptJson(r.pages) : null,
        engine: r.engine,
        meta: { pages: r.pages?.length ?? null },
      })
      .where(eq(schema.source.id, sourceId));
  } catch (err) {
    logger.warn('extract.failed', { sourceId, err });
    const msg = (err as Error).message;
    if (opts.rethrow && msg !== 'OCR_NOT_CONFIGURED' && msg !== 'UNSUPPORTED_TYPE') throw err;
    await db
      .update(schema.source)
      .set({
        status: 'failed',
        error:
          msg === 'OCR_NOT_CONFIGURED'
            ? 'Reading photos and scans is not set up yet. The file is kept.'
            : 'The text could not be read from this file. The original is kept.',
      })
      .where(eq(schema.source.id, sourceId));
  }
  await continueToRefine(src.encounterId);
}
