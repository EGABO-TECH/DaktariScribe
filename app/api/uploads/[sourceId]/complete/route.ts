import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { dispatch } from '@/lib/jobs/dispatch';
import { ConflictError, markUploaded, sourceForUpload } from '@/lib/records/service';
import { receivedParts } from '@/lib/storage';

const body = z.object({ files: z.array(z.object({ index: z.number().int().min(0), parts: z.number().int().min(1).max(10000) })).min(1) });

/** POST /api/uploads/:sourceId/complete — checks every part arrived, then starts transcription/extraction. */
export async function POST(request: Request, ctx: RouteContext<'/api/uploads/[sourceId]/complete'>) {
  const { sourceId } = await ctx.params;
  try {
    const auth = await requireAuth();
    const input = body.parse(await request.json().catch(() => null));
    const src = await sourceForUpload(auth, sourceId);
    if (src.status !== 'pending_upload') return NextResponse.json({ ok: true, already: true });
    if (input.files.length !== src.fileCount) throw new ConflictError('Some files are missing from this upload.');
    const got = await receivedParts(sourceId);
    const missing = input.files.filter((f) => {
      const parts = got.get(f.index) ?? [];
      return parts.length !== f.parts || parts.some((p, i) => p !== i);
    });
    if (missing.length) {
      return NextResponse.json({ error: 'Some parts have not arrived yet.', missing: missing.map((m) => m.index) }, { status: 409 });
    }
    if (await markUploaded(auth, sourceId)) {
      await dispatch({ name: src.kind === 'audio' ? 'source/transcribe.requested' : 'source/extract.requested', data: { sourceId } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 'upload.complete', { sourceId });
  }
}
