import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { refinedRecord } from '@/lib/records/refined-record';
import { saveEditedVersion } from '@/lib/records/service';

const body = z.object({ baseVersionId: z.string().min(1).max(64), content: refinedRecord });

/** POST /api/encounters/:id/versions — saves the author's edits as a new version (originals untouched). */
export async function POST(request: Request, ctx: RouteContext<'/api/encounters/[id]/versions'>) {
  const { id } = await ctx.params;
  try {
    const auth = await requireAuth();
    const input = body.parse(await request.json().catch(() => null));
    const result = await saveEditedVersion(auth, id, input.content, input.baseVersionId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'version.create', { encounterId: id });
  }
}
