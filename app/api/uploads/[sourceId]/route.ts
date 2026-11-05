import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { sourceForUpload } from '@/lib/records/service';
import { receivedParts } from '@/lib/storage';

/** GET /api/uploads/:sourceId — which parts have arrived (to resume after a dropped connection). */
export async function GET(_request: Request, ctx: RouteContext<'/api/uploads/[sourceId]'>) {
  const { sourceId } = await ctx.params;
  try {
    const auth = await requireAuth();
    const src = await sourceForUpload(auth, sourceId);
    const parts = await receivedParts(sourceId);
    return NextResponse.json(
      { status: src.status, files: src.fileCount, received: Object.fromEntries(parts) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return errorResponse(err, 'upload.status', { sourceId });
  }
}
