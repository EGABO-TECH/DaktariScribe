import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { assertCanExport } from '@/lib/encounter-status';
import { renderRecordPdf, pdfFilename } from '@/lib/exports/pdf';
import { getRecordDetail, recordExport } from '@/lib/records/service';

export const runtime = 'nodejs';

/**
 * GET /api/exports/:id — branded PDF of a signed-off record.
 * The export gate reads the status from the database; the client cannot override it.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/exports/[id]'>) {
  const { id } = await ctx.params;
  try {
    const auth = await requireAuth();
    const record = await getRecordDetail(auth, id);
    assertCanExport(record.status);
    const pdf = await renderRecordPdf(record, auth.orgName ?? 'Personal workspace');
    await recordExport(auth, id, 'pdf');
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfFilename(id)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return errorResponse(err, 'export.pdf', { encounterId: id });
  }
}
