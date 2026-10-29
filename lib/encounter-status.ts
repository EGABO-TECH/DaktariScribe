/**
 * Encounter Status Machine and Safety Gates
 * Implements TASK-1.1 (F-01): Mandatory human-review gate before export
 */

export type EncounterStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'REVIEWED' | 'EXPORTED';

export interface ReviewMetadata {
  reviewedBy: string;
  reviewedAt: string; // ISO timestamp
  clinicianAttestation: boolean; // Must be true ("I have reviewed and take responsibility for this note")
}

export interface EncounterState {
  id: string;
  status: EncounterStatus;
  reviewMetadata?: ReviewMetadata;
  unconfirmedEntitiesCount?: number;
}

export class StatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatusTransitionError';
  }
}

/**
 * Checks whether an encounter is allowed to be exported to PDF.
 * Rule: PDF export is strictly disabled unless status is REVIEWED or already EXPORTED.
 */
export function canExportEncounter(status: EncounterStatus): boolean {
  return status === 'REVIEWED' || status === 'EXPORTED';
}

/**
 * Validates and executes a transition from one status to another.
 */
export function transitionEncounterStatus(
  current: EncounterState,
  target: EncounterStatus,
  reviewInput?: {
    reviewerId: string;
    attestation: boolean;
  }
): EncounterState {
  if (current.status === target) {
    return current;
  }

  switch (target) {
    case 'NEEDS_REVIEW':
      if (current.status !== 'DRAFT' && current.status !== 'REVIEWED') {
        throw new StatusTransitionError(
          `Cannot transition to NEEDS_REVIEW from ${current.status}.`
        );
      }
      return {
        ...current,
        status: 'NEEDS_REVIEW',
      };

    case 'REVIEWED': {
      if (current.status !== 'NEEDS_REVIEW') {
        throw new StatusTransitionError(
          `Cannot mark as REVIEWED from ${current.status}. Note must be in NEEDS_REVIEW status first.`
        );
      }

      if (current.unconfirmedEntitiesCount && current.unconfirmedEntitiesCount > 0) {
        throw new StatusTransitionError(
          `Cannot mark note as REVIEWED with ${current.unconfirmedEntitiesCount} unconfirmed high-risk clinical entities.`
        );
      }

      if (!reviewInput) {
        throw new StatusTransitionError('Reviewer information and attestation are required.');
      }

      if (!reviewInput.reviewerId || reviewInput.reviewerId.trim() === '') {
        throw new StatusTransitionError('A valid clinician reviewer ID/name is required.');
      }

      if (!reviewInput.attestation) {
        throw new StatusTransitionError(
          'Clinician attestation checkbox must be confirmed before reviewing.'
        );
      }

      return {
        ...current,
        status: 'REVIEWED',
        reviewMetadata: {
          reviewedBy: reviewInput.reviewerId.trim(),
          reviewedAt: new Date().toISOString(),
          clinicianAttestation: true,
        },
      };
    }

    case 'EXPORTED': {
      if (!canExportEncounter(current.status)) {
        throw new StatusTransitionError(
          `Export blocked: Cannot export encounter with status '${current.status}'. Encounter must be REVIEWED by a licensed clinician before export.`
        );
      }

      return {
        ...current,
        status: 'EXPORTED',
      };
    }

    case 'DRAFT':
      // Reverting to draft resets review
      return {
        ...current,
        status: 'DRAFT',
        reviewMetadata: undefined,
      };

    default:
      throw new StatusTransitionError(`Unknown target status: ${target}`);
  }
}

/**
 * Server-side / API-level gate for export validation.
 */
export function assertCanExport(encounter: EncounterState): void {
  if (!canExportEncounter(encounter.status)) {
    throw new StatusTransitionError(
      `Access Denied (403): Cannot export unreviewed note. Current status is ${encounter.status}. Mandatory clinician validation required.`
    );
  }
}
