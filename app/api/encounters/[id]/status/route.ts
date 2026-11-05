import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { encounterScope, NotFoundError } from '@/lib/records/service';

/** GET /api/encounters/:id/status — lightweight progress for the "Uploading → Transcribing → Organising" bar. */
export async function GET(_request: Request, ctx: RouteContext<'/api/encounters/[id]/status'>) {
  const { id } = await ctx.params;
  try {
    const auth = await requireAuth();
    const db = getDb();
    const [enc] = await db
      .select({ status: schema.encounter.status })
      .from(schema.encounter)
      .where(and(encounterScope(auth), eq(schema.encounter.id, id)))
      .limit(1);
    if (!enc) throw new NotFoundError();
    const sources = await db
      .select({ id: schema.source.id, kind: schema.source.kind, status: schema.source.status, error: schema.source.error })
      .from(schema.source)
      .where(eq(schema.source.encounterId, id));
    let step: 'uploading' | 'transcribing' | 'organising' | 'ready' = 'organising';
    if (enc.status === 'in_review' || enc.status === 'final') step = 'ready';
    else if (sources.some((s) => s.status === 'pending_upload')) step = 'uploading';
    else if (sources.some((s) => s.status === 'pending' || s.status === 'processing')) step = 'transcribing';
    return NextResponse.json({ status: enc.status, step, sources }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err, 'encounter.status', { encounterId: id });
  }
}
