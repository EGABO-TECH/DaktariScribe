/**
 * Encounter status rules and safety gates (spec §4, §8: "Nothing becomes Final without the
 * worker's sign-off"). Pure functions; the server always evaluates them against the status
 * stored in the database, never a status sent by the client.
 */
import type { EncounterStatus } from '@/db/schema';

export type { EncounterStatus };

export const ENCOUNTER_STATUSES: EncounterStatus[] = ['draft', 'processing', 'in_review', 'final'];

export class StatusGateError extends Error {
  status: 403 | 409;
  constructor(message: string, status: 403 | 409 = 409) {
    super(message);
    this.name = 'StatusGateError';
    this.status = status;
  }
}

/** Only signed-off (Final) records can be exported. */
export function canExport(status: EncounterStatus): boolean {
  return status === 'final';
}

export function assertCanExport(status: EncounterStatus): void {
  if (!canExport(status)) {
    throw new StatusGateError('This record has not been signed off yet. Review and sign it off before exporting.', 403);
  }
}

export type SignOffCheck = {
  status: EncounterStatus;
  isAuthor: boolean;
  hasVersion: boolean;
  attested: boolean;
  /** Phase 2: unresolved blocking verification flags. */
  blockingFlags?: number;
};

/** Returns null when sign-off is allowed, otherwise the reason it is blocked. */
export function signOffBlocker(c: SignOffCheck): string | null {
  if (!c.isAuthor) return 'Only the author can sign off this record.';
  if (c.status === 'final') return 'This record is already signed off.';
  if (c.status !== 'in_review') return 'This record is not ready for review yet.';
  if (!c.hasVersion) return 'There is no version to sign off.';
  if ((c.blockingFlags ?? 0) > 0) return `Resolve ${c.blockingFlags} flagged item(s) before signing off.`;
  if (!c.attested) return 'Confirm the sign-off statement first.';
  return null;
}

/** Records can only be edited while in review; Final records are locked. */
export function canEdit(status: EncounterStatus, isAuthor: boolean): boolean {
  return isAuthor && status === 'in_review';
}
