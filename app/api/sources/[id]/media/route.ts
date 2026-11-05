import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { NotFoundError, sourceForRead } from '@/lib/records/service';
import { readFile, receivedParts } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * GET /api/sources/:id/media?file=N — the original recording segment or uploaded file,
 * decrypted on the fly after an org/role check. Never cached; no shareable link exists.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/sources/[id]/media'>) {
  const { id } = await ctx.params;
  try {
    const auth = await requireAuth();
    const src = await sourceForRead(auth, id);
    if (src.kind === 'text') throw new NotFoundError();
    const file = Number(request.nextUrl.searchParams.get('file') ?? 0);
    if (!Number.isInteger(file) || file < 0 || file >= Math.max(1, src.fileCount)) throw new NotFoundError();
    const parts = (await receivedParts(id)).get(file)?.length ?? 0;
    if (!parts) throw new NotFoundError();
    const data = await readFile(id, file, parts);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': src.mimeType ?? 'application/octet-stream',
        'Content-Length': String(data.length),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return errorResponse(err, 'source.media', { sourceId: id });
  }
}
