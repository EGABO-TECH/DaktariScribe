import { describe, expect, it } from 'vitest';
import { isSessionExistsError } from '@/components/auth/session-recovery';

describe('isSessionExistsError', () => {
  it('recognises Clerk "already signed in" errors', () => {
    expect(isSessionExistsError({ errors: [{ code: 'session_exists' }] })).toBe(true);
    expect(isSessionExistsError({ errors: [{ code: 'identifier_already_signed_in' }] })).toBe(true);
  });
  it('ignores other errors', () => {
    expect(isSessionExistsError({ errors: [{ code: 'form_password_incorrect' }] })).toBe(false);
    expect(isSessionExistsError(new Error('network'))).toBe(false);
    expect(isSessionExistsError(null)).toBe(false);
  });
});
