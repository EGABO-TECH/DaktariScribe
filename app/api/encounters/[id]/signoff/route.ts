import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUserDisplayName, requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { signOffRecord } from '@/lib/records/service';

const body = z.object({ versionId: z.string().min(1).max(64), attested: z.boolean() });

/** POST /api/encounters/:id/signoff — the author signs off the current version; record becomes Final. */
export async function POST(request: Request, ctx: RouteContext<'/api/encounters/[id]/signoff'>) {
  const { id } = await ctx.params;
  try {
    const auth = await requireAuth();
    const input = body.parse(await request.json().catch(() => null));
    const signerName = await currentUserDisplayName();
    await signOffRecord(auth, id, signerName, input.versionId, input.attested);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, 'encounter.signoff', { encounterId: id });
  }
}
