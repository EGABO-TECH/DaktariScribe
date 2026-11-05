import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { limit } from '@/lib/ratelimit';
import { reprocessEncounter } from '@/lib/records/service';

/** POST /api/encounters/:id/reprocess — organise the originals again (free; final records excluded). */
export async function POST(_request: Request, ctx: RouteContext<'/api/encounters/[id]/reprocess'>) {
  const { id } = await ctx.params;
  try {
    const auth = await requireAuth();
    await limit('create', auth.userId);
    await reprocessEncounter(auth, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 'encounter.reprocess', { encounterId: id });
  }
}
