import { NextResponse, type NextRequest } from 'next/server';
import { currentUserDisplayName, requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { createTextEncounter, createTextEncounterInput } from '@/lib/records/service';

/** POST /api/encounters — "Process": creates the encounter and its original text source. */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await request.json().catch(() => null);
    const input = createTextEncounterInput.parse(body);
    const workerName = await currentUserDisplayName();
    const result = await createTextEncounter(ctx, workerName, input);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return errorResponse(err, 'encounter.create');
  }
}
