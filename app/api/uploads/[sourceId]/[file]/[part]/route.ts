import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { limit } from '@/lib/ratelimit';
import { ConflictError, sourceForUpload } from '@/lib/records/service';
import { MAX_PART_BYTES, partKey, storage } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * PUT /api/uploads/:sourceId/:file/:part — one chunk (≤ 4 MB) of one file. Encrypted before it
 * is stored. Re-sending a part overwrites it, so retries are safe.
 */
export async function PUT(request: Request, ctx: RouteContext<'/api/uploads/[sourceId]/[file]/[part]'>) {
  const { sourceId, file, part } = await ctx.params;
  try {
    const auth = await requireAuth();
    await limit('upload', auth.userId);
    const src = await sourceForUpload(auth, sourceId);
    if (src.status !== 'pending_upload') throw new ConflictError('This upload is already complete.');
    const fileNo = Number(file);
    const partNo = Number(part);
    if (!Number.isInteger(fileNo) || fileNo < 0 || fileNo >= src.fileCount || !Number.isInteger(partNo) || partNo < 0 || partNo > 9999)
      throw new ConflictError('Invalid part.');
    const body = Buffer.from(await request.arrayBuffer());
    if (!body.length || body.length > MAX_PART_BYTES) throw new ConflictError('Each part must be between 1 byte and 4 MB.');
    await storage.put(partKey(sourceId, fileNo, partNo), body);
    return NextResponse.json({ ok: true, bytes: body.length });
  } catch (err) {
    return errorResponse(err, 'upload.part', { sourceId });
  }
}
