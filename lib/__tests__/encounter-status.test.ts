import { describe, it, expect } from 'vitest';
import { assertCanExport, canEdit, canExport, signOffBlocker, StatusGateError } from '@/lib/encounter-status';

describe('export gate', () => {
  it('allows export only for final records', () => {
    expect(canExport('final')).toBe(true);
    expect(canExport('in_review')).toBe(false);
    expect(canExport('processing')).toBe(false);
    expect(canExport('draft')).toBe(false);
  });

  it('assertCanExport throws a 403 for anything not final', () => {
    for (const s of ['draft', 'processing', 'in_review'] as const) {
      try {
        assertCanExport(s);
        throw new Error('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(StatusGateError);
        expect((e as StatusGateError).status).toBe(403);
      }
    }
    expect(() => assertCanExport('final')).not.toThrow();
  });
});

describe('sign-off gate', () => {
  const ok = { status: 'in_review' as const, isAuthor: true, hasVersion: true, attested: true };

  it('allows the author to sign off a record in review with attestation', () => {
    expect(signOffBlocker(ok)).toBeNull();
  });

  it('blocks non-authors, wrong statuses, missing attestation and blocking flags', () => {
    expect(signOffBlocker({ ...ok, isAuthor: false })).toMatch(/author/);
    expect(signOffBlocker({ ...ok, status: 'final' })).toMatch(/already/);
    expect(signOffBlocker({ ...ok, status: 'processing' })).toMatch(/not ready/);
    expect(signOffBlocker({ ...ok, status: 'draft' })).toMatch(/not ready/);
    expect(signOffBlocker({ ...ok, hasVersion: false })).toMatch(/no version/);
    expect(signOffBlocker({ ...ok, attested: false })).toMatch(/Confirm/);
    expect(signOffBlocker({ ...ok, blockingFlags: 2 })).toMatch(/2 flagged/);
  });

  it('locks final records against edits', () => {
    expect(canEdit('in_review', true)).toBe(true);
    expect(canEdit('final', true)).toBe(false);
    expect(canEdit('in_review', false)).toBe(false);
  });
});
