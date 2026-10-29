import { describe, it, expect } from 'vitest';
import {
  canExportEncounter,
  transitionEncounterStatus,
  assertCanExport,
  StatusTransitionError,
  EncounterState,
} from '../encounter-status';

describe('Encounter Status Machine & Review Gate (TASK-1.1 / F-01)', () => {
  it('correctly reports canExportEncounter only for REVIEWED and EXPORTED', () => {
    expect(canExportEncounter('DRAFT')).toBe(false);
    expect(canExportEncounter('NEEDS_REVIEW')).toBe(false);
    expect(canExportEncounter('REVIEWED')).toBe(true);
    expect(canExportEncounter('EXPORTED')).toBe(true);
  });

  it('assertCanExport throws error for unreviewed encounters', () => {
    const draft: EncounterState = { id: 'enc-1', status: 'DRAFT' };
    const needsReview: EncounterState = { id: 'enc-2', status: 'NEEDS_REVIEW' };
    const reviewed: EncounterState = { id: 'enc-3', status: 'REVIEWED' };

    expect(() => assertCanExport(draft)).toThrow(StatusTransitionError);
    expect(() => assertCanExport(needsReview)).toThrow(StatusTransitionError);
    expect(() => assertCanExport(reviewed)).not.toThrow();
  });

  it('transitions from DRAFT to NEEDS_REVIEW', () => {
    const draft: EncounterState = { id: 'enc-1', status: 'DRAFT' };
    const updated = transitionEncounterStatus(draft, 'NEEDS_REVIEW');
    expect(updated.status).toBe('NEEDS_REVIEW');
  });

  it('rejects transitioning directly from DRAFT to REVIEWED without review process', () => {
    const draft: EncounterState = { id: 'enc-1', status: 'DRAFT' };
    expect(() =>
      transitionEncounterStatus(draft, 'REVIEWED', {
        reviewerId: 'clinician-123',
        attestation: true,
      })
    ).toThrow(StatusTransitionError);
  });

  it('requires reviewer ID and attestation checkbox to mark as REVIEWED', () => {
    const pending: EncounterState = { id: 'enc-1', status: 'NEEDS_REVIEW' };

    // Missing reviewer input
    expect(() => transitionEncounterStatus(pending, 'REVIEWED')).toThrow(
      'Reviewer information and attestation are required.'
    );

    // Missing reviewer ID
    expect(() =>
      transitionEncounterStatus(pending, 'REVIEWED', {
        reviewerId: '',
        attestation: true,
      })
    ).toThrow('A valid clinician reviewer ID/name is required.');

    // Unchecked attestation
    expect(() =>
      transitionEncounterStatus(pending, 'REVIEWED', {
        reviewerId: 'Dr. Jane Smith',
        attestation: false,
      })
    ).toThrow('Clinician attestation checkbox must be confirmed before reviewing.');
  });

  it('successfully transitions from NEEDS_REVIEW to REVIEWED when verified', () => {
    const pending: EncounterState = { id: 'enc-1', status: 'NEEDS_REVIEW' };
    const reviewed = transitionEncounterStatus(pending, 'REVIEWED', {
      reviewerId: 'Dr. Aaron Egabo',
      attestation: true,
    });

    expect(reviewed.status).toBe('REVIEWED');
    expect(reviewed.reviewMetadata).toBeDefined();
    expect(reviewed.reviewMetadata?.reviewedBy).toBe('Dr. Aaron Egabo');
    expect(reviewed.reviewMetadata?.clinicianAttestation).toBe(true);
    expect(reviewed.reviewMetadata?.reviewedAt).toBeDefined();
  });

  it('blocks transition to REVIEWED if there are unconfirmed high-risk entities', () => {
    const pendingWithRisk: EncounterState = {
      id: 'enc-1',
      status: 'NEEDS_REVIEW',
      unconfirmedEntitiesCount: 2,
    };

    expect(() =>
      transitionEncounterStatus(pendingWithRisk, 'REVIEWED', {
        reviewerId: 'Dr. Aaron Egabo',
        attestation: true,
      })
    ).toThrow('Cannot mark note as REVIEWED with 2 unconfirmed high-risk clinical entities.');
  });

  it('allows EXPORTED transition only from REVIEWED', () => {
    const pending: EncounterState = { id: 'enc-1', status: 'NEEDS_REVIEW' };
    expect(() => transitionEncounterStatus(pending, 'EXPORTED')).toThrow(
      'Export blocked: Cannot export encounter with status \'NEEDS_REVIEW\'.'
    );

    const reviewed: EncounterState = {
      id: 'enc-1',
      status: 'REVIEWED',
      reviewMetadata: {
        reviewedBy: 'Dr. Aaron Egabo',
        reviewedAt: new Date().toISOString(),
        clinicianAttestation: true,
      },
    };

    const exported = transitionEncounterStatus(reviewed, 'EXPORTED');
    expect(exported.status).toBe('EXPORTED');
  });
});
