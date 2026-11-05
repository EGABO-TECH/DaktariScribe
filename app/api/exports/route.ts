import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { limit } from '@/lib/ratelimit';
import { buildExportDoc, exportScope } from '@/lib/exports/data';
import { CONTENT_TYPES, exportFilename, renderExport } from '@/lib/exports/render';
import { recordExport, ConflictError } from '@/lib/records/service';
import { assertFeature, exportWatermark } from '@/lib/billing/entitlements';
import { recordUsage } from '@/lib/billing/usage';

export const runtime = 'nodejs';
export const maxDuration = 300;

const body = z.object({
  scope: exportScope,
  format: z.enum(['pdf', 'docx', 'pptx']),
  language: z.string().regex(/^[a-z]{3}$/).default('eng'),
  includeOriginals: z.boolean().optional(),
});

/**
 * POST /api/exports — PDF, Word or slides for one Final record or a filtered set, in the chosen
 * language. Only Final records are ever included. Reading/exporting Finals never needs a pass,
 * but Word, slides, aggregates and translation follow the pass features when billing is on.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireAuth();
    await limit('export', ctx.userId);
    const input = body.parse(await request.json().catch(() => null));
    const single = 'encounterIds' in input.scope && input.scope.encounterIds.length === 1;
    if (input.format === 'docx') await assertFeature(ctx.userId, ctx.orgId, 'docx', 'Word export needs a Weekly pass or higher. PDF is always available.');
    if (input.format === 'pptx') await assertFeature(ctx.userId, ctx.orgId, 'pptx', 'Slide decks need a Monthly Pro pass.');
    if (!single) await assertFeature(ctx.userId, ctx.orgId, 'aggregate', 'Reports across many records need a Monthly Pro pass.');
    if (input.language !== 'eng') {
      try {
        await assertFeature(ctx.userId, ctx.orgId, 'translate_all', '');
      } catch {
        await assertFeature(ctx.userId, ctx.orgId, 'translate_1', 'Translated exports need a Weekly pass or higher.');
      }
    }

    const doc = await buildExportDoc(ctx, input.scope, {
      lang: input.language,
      watermark: await exportWatermark(ctx.userId, ctx.orgId),
      includeOriginals: input.includeOriginals,
    });
    if (!doc.records.length) throw new ConflictError('No signed-off records match. Only Final records can be exported.');
    if (input.format === 'pptx' && !doc.aggregate) doc.aggregate = true;

    const file = await renderExport(doc, input.format);
    for (const r of doc.records) await recordExport(ctx, r.id, input.format);
    await recordUsage({ orgId: ctx.orgId, userId: ctx.userId, kind: 'export', quantity: 1 });
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': CONTENT_TYPES[input.format],
        'Content-Disposition': `attachment; filename="${exportFilename(doc, input.format)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return errorResponse(err, 'export.create');
  }
}
