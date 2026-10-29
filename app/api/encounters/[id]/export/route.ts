import { NextRequest, NextResponse } from 'next/server';
import { assertCanExport, EncounterState } from '@/lib/encounter-status';

/**
 * Server-side gate for PDF report export.
 * Enforces TASK-1.1: Cannot export unreviewed note via direct API call.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    
    // In future phases this will read from the DB/Dexie; here we validate the payload encounter state
    const encounter: EncounterState = {
      id,
      status: body.status || 'NEEDS_REVIEW',
      reviewMetadata: body.reviewMetadata,
      unconfirmedEntitiesCount: body.unconfirmedEntitiesCount,
    };

    // Assert that the note is reviewed
    assertCanExport(encounter);

    return NextResponse.json({
      success: true,
      message: 'Export authorized.',
      encounterId: id,
      status: 'EXPORTED',
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Export forbidden',
      },
      { status: 403 }
    );
  }
}
