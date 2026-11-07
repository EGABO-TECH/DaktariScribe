'use client';

import { useState } from 'react';
import type { useSignIn } from '@clerk/nextjs/legacy';

type SignIn = NonNullable<ReturnType<typeof useSignIn>['signIn']>;
type CodeStrategy = 'email_code' | 'phone_code' | 'totp' | 'backup_code';

export type CodeChallenge = { strategy: CodeStrategy; destination?: string };

/**
 * Clerk asks for a second step when two-step verification is on (needs_second_factor) or when
 * someone signs in with a password on a device it hasn't seen before (needs_client_trust).
 */
export function needsCode(status: string | null | undefined): boolean {
  return status === 'needs_second_factor' || status === 'needs_client_trust';
}

/** Picks the best available method and, for email and text codes, sends the code. */
export async function startCodeChallenge(signIn: SignIn): Promise<CodeChallenge> {
  const factors = signIn.supportedSecondFactors ?? [];
  for (const f of factors) {
    if (f.strategy === 'email_code') {
      await signIn.prepareSecondFactor({ strategy: 'email_code', emailAddressId: f.emailAddressId });
      return { strategy: 'email_code', destination: f.safeIdentifier };
    }
  }
  for (const f of factors) {
    if (f.strategy === 'phone_code') {
      await signIn.prepareSecondFactor({ strategy: 'phone_code', phoneNumberId: f.phoneNumberId });
      return { strategy: 'phone_code', destination: f.safeIdentifier };
    }
  }
  if (factors.some((f) => f.strategy === 'totp')) return { strategy: 'totp' };
  if (factors.some((f) => f.strategy === 'backup_code')) return { strategy: 'backup_code' };
  throw new Error('This account needs a verification method that DaktariScribe does not support yet. Please contact support.');
}

function attempt(signIn: SignIn, strategy: CodeStrategy, code: string) {
  switch (strategy) {
    case 'email_code':
      return signIn.attemptSecondFactor({ strategy: 'email_code', code });
    case 'phone_code':
      return signIn.attemptSecondFactor({ strategy: 'phone_code', code });
    case 'totp':
      return signIn.attemptSecondFactor({ strategy: 'totp', code });
    case 'backup_code':
      return signIn.attemptSecondFactor({ strategy: 'backup_code', code });
  }
}

export function clerkErrorMessage(err: unknown, fallback: string): string {
  const e = err as { errors?: Array<{ longMessage?: string; message?: string }>; message?: string };
  return e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e?.message || fallback;
}

function instructions({ strategy, destination }: CodeChallenge): string {
  switch (strategy) {
    case 'email_code':
      return `We sent a 6-digit code to ${destination ?? 'your email address'}. Enter it to finish signing in.`;
    case 'phone_code':
      return `We sent a 6-digit code by text message to ${destination ?? 'your phone'}. Enter it to finish signing in.`;
    case 'totp':
      return 'Enter the 6-digit code from your authenticator app.';
    case 'backup_code':
      return 'Enter one of your backup codes.';
  }
}

type Props = {
  signIn: SignIn;
  challenge: CodeChallenge;
  onComplete: (sessionId: string) => Promise<void>;
  onCancel: () => void;
  inputClassName: string;
  buttonClassName: string;
};

export default function SecondFactorStep({ signIn, challenge, onComplete, onCancel, inputClassName, buttonClassName }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const numeric = challenge.strategy !== 'backup_code';
  const canResend = challenge.strategy === 'email_code' || challenge.strategy === 'phone_code';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (!value) return setError('Enter the code to continue.');
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await attempt(signIn, challenge.strategy, value);
      if (result.status === 'complete' && result.createdSessionId) {
        await onComplete(result.createdSessionId);
      } else {
        setError('Verification is not finished yet. Please try again.');
      }
    } catch (err) {
      setError(clerkErrorMessage(err, 'That code did not work. Check it and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await startCodeChallenge(signIn);
      setNotice('A new code is on its way.');
    } catch (err) {
      setError(clerkErrorMessage(err, 'A new code could not be sent. Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <p className="text-sm text-center text-[#3d5a73]">{instructions(challenge)}</p>

      {error && (
        <div role="alert" className="p-3 bg-error/10 border border-error/20 text-error rounded-lg text-sm text-center">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="p-3 bg-[#00b896]/10 border border-[#00b896]/30 text-[#0d2240] rounded-lg text-sm text-center">
          {notice}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="verification-code" className="block text-[10px] font-bold tracking-[0.14em] uppercase text-[#3d5a73]">
          Verification code
        </label>
        <input
          id="verification-code"
          type="text"
          inputMode={numeric ? 'numeric' : 'text'}
          autoComplete="one-time-code"
          autoFocus
          placeholder={numeric ? '123456' : ''}
          className={inputClassName}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </div>

      <button type="submit" disabled={busy} className={buttonClassName}>
        {busy ? 'Checking…' : 'Verify and continue'}
      </button>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-semibold">
        {canResend && (
          <button type="button" onClick={resend} disabled={busy} className="min-h-11 text-[#00b896] hover:underline disabled:opacity-60">
            Send a new code
          </button>
        )}
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 text-[#3d5a73] hover:text-[#00b896] disabled:opacity-60">
          Start again
        </button>
      </div>
    </form>
  );
}
