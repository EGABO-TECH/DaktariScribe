import { NextResponse, type NextRequest } from 'next/server';
import { currentUserDisplayName, requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { limit } from '@/lib/ratelimit';
import { createEncounter, createEncounterInput } from '@/lib/records/service';

/**
 * POST /api/encounters — "Process": creates the encounter with its original sources.
 * Typed text is stored immediately; recordings and files are declared here and uploaded next
 * (the response lists the source IDs to upload to). Idempotent on `idempotencyKey`.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    await limit('create', ctx.userId);
    const input = createEncounterInput.parse(await request.json().catch(() => null));
    const workerName = await currentUserDisplayName();
    const result = await createEncounter(ctx, workerName, input);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return errorResponse(err, 'encounter.create');
  }
}
