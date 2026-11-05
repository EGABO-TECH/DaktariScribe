import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { assertCanExport } from '@/lib/encounter-status';
import { limit } from '@/lib/ratelimit';
import { buildExportDoc } from '@/lib/exports/data';
import { CONTENT_TYPES, exportFilename, renderExport } from '@/lib/exports/render';
import { getRecordDetail, recordExport } from '@/lib/records/service';
import { exportWatermark } from '@/lib/billing/entitlements';

export const runtime = 'nodejs';

/**
 * GET /api/exports/:id — English PDF of one signed-off record (the quick download link).
 * The export gate reads the status from the database; the client cannot override it.
 * Finals can always be exported, with or without an active pass.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/exports/[id]'>) {
  const { id } = await ctx.params;
  try {
    const auth = await requireAuth();
    await limit('export', auth.userId);
    const record = await getRecordDetail(auth, id);
    assertCanExport(record.status);
    const doc = await buildExportDoc(auth, { encounterIds: [id] }, { lang: 'eng', watermark: await exportWatermark(auth.userId, auth.orgId) });
    const pdf = await renderExport(doc, 'pdf');
    await recordExport(auth, id, 'pdf');
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': CONTENT_TYPES.pdf,
        'Content-Disposition': `attachment; filename="${exportFilename(doc, 'pdf')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return errorResponse(err, 'export.pdf', { encounterId: id });
  }
}
