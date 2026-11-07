'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy';
import { useRouter } from 'next/navigation';
import { organisationErrorMessage } from '@/lib/organisation-errors';

const MIN_PASSWORD = 8;
const AFTER_JOIN_URL = '/field-entry';
const inputCls =
  'block h-12 w-full rounded-lg border border-[#d0e8e4] bg-[#f0f7f6] px-3.5 text-[16px] text-[#0d2240] outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-[#00b896] focus:bg-white focus:ring-[3px] focus:ring-[#00b896]/15';
const labelCls = 'mb-1.5 block text-[14px] font-semibold text-[#0d2240]';
const linkBtnCls = 'btn-ds-primary';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="force-light flex min-h-dvh flex-col items-center bg-[#eef6f5] px-4 pb-6 pt-8 text-[#0d2240] sm:px-8 sm:pt-12">
      <main id="main" className="my-auto w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#d0e8e4] bg-white shadow-2xl shadow-[rgba(0,185,150,0.10)]">
        <div className="flex flex-col items-center px-6 pb-7 pt-8 text-center sm:px-10" style={{ background: 'linear-gradient(145deg, #0d2240 0%, #1a3a5c 60%, #00956e 100%)' }}>
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-lg">
            <Image src="/assets/DaktariScribe-Favicon.png" alt="DaktariScribe" width={48} height={48} className="object-contain" priority />
          </span>
          <h1 className="font-display-lg text-[26px] font-bold leading-tight tracking-tight text-white sm:text-[30px]">{title}</h1>
          <p className="mt-1.5 text-[15px] text-[#a8f0e6]">{subtitle}</p>
        </div>
        <div className="p-6 sm:p-8">{children}</div>
      </main>
      <p className="pt-8 text-center text-[12px] uppercase tracking-widest text-[#8fafc0]">© 2026 DaktariScribe</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="mb-5 rounded-lg border border-error/40 bg-error-container px-3.5 py-3 text-[14px] text-on-error-container">
      {message}
    </p>
  ) : null;
}

function ExistingAccount({ ticket }: { ticket: string }) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const accept = async () => {
    if (!isLoaded || !signIn || !setActive) return setError('Still connecting. Check your internet connection and try again in a moment.');
    setBusy(true);
    setError('');
    try {
      const result = await signIn.create({ strategy: 'ticket', ticket });
      if (result.status !== 'complete') throw new Error('incomplete');
      await setActive({ session: result.createdSessionId });
      router.push(AFTER_JOIN_URL);
    } catch (err) {
      setError(organisationErrorMessage(err, 'This invitation could not be accepted. It may have expired. Ask your admin to send a new one.'));
      setBusy(false);
    }
  };

  return (
    <Shell title="Join your team" subtitle="You have been invited to an organisation on DaktariScribe.">
      <ErrorBox message={error} />
      <button type="button" onClick={accept} disabled={busy} className={linkBtnCls}>
        {busy ? 'Joining…' : 'Accept invitation'}
      </button>
    </Shell>
  );
}

function NewAccount({ ticket }: { ticket: string }) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return setError('Enter your first and last name.');
    if (password.length < MIN_PASSWORD) return setError(`Use a password of at least ${MIN_PASSWORD} characters.`);
    if (confirm !== password) return setError('The passwords do not match.');
    if (!agreed) return setError('Please accept the terms to continue.');
    if (!isLoaded || !signUp || !setActive) return setError('Still connecting. Check your internet connection and try again in a moment.');
    setBusy(true);
    setError('');
    try {
      // The ticket proves the email address, so no verification code is needed.
      const result = await signUp.create({ strategy: 'ticket', ticket, firstName: firstName.trim(), lastName: lastName.trim(), password });
      if (result.status !== 'complete') throw new Error('incomplete');
      await setActive({ session: result.createdSessionId });
      router.push(AFTER_JOIN_URL);
    } catch (err) {
      setError(organisationErrorMessage(err, 'Your account could not be created. The invitation may have expired. Ask your admin to send a new one.'));
      setBusy(false);
    }
  };

  return (
    <Shell title="Join your team" subtitle="Create your account to accept the invitation.">
      <ErrorBox message={error} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="first-name" className={labelCls}>
              First name
            </label>
            <input id="first-name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="last-name" className={labelCls}>
              Last name
            </label>
            <input id="last-name" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="password" className={labelCls}>
              Password
            </label>
            <input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            <p className="mt-1.5 text-[13px] text-[#3d5a73]">At least {MIN_PASSWORD} characters</p>
          </div>
          <div>
            <label htmlFor="confirm" className={labelCls}>
              Confirm password
            </label>
            <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </div>
        </div>
        <label htmlFor="terms" className="flex cursor-pointer items-start gap-3 py-1">
          <input id="terms" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[#0d2240]" />
          <span className="text-[14px] leading-6 text-[#3d5a73]">
            I agree to the{' '}
            <Link href="/legal/terms" target="_blank" className="font-semibold text-[#00957a] underline-offset-2 hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" target="_blank" className="font-semibold text-[#00957a] underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            , and I understand that I review and sign off every report before it is final.
          </span>
        </label>
        <button type="submit" disabled={busy} className={linkBtnCls}>
          {busy ? 'Creating account…' : 'Create account and join'}
        </button>
      </form>
    </Shell>
  );
}

export default function AcceptInvitation({ ticket, status }: { ticket: string | null; status: string | null }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (status === 'complete') {
    return (
      <Shell title="You have joined" subtitle="Your invitation has been accepted.">
        <Link href={AFTER_JOIN_URL} className={linkBtnCls}>
          Open DaktariScribe
        </Link>
      </Shell>
    );
  }
  if (!ticket || (status !== 'sign_in' && status !== 'sign_up')) {
    return (
      <Shell title="This link is not complete" subtitle="Open the full link from your invitation email.">
        <Link href="/" className={linkBtnCls}>
          Go to sign in
        </Link>
      </Shell>
    );
  }
  if (!isLoaded) {
    return (
      <Shell title="Join your team" subtitle="Getting your invitation ready…">
        <p role="status" className="text-center text-[#3d5a73]">
          Loading…
        </p>
      </Shell>
    );
  }
  if (isSignedIn) {
    // A signed-in session can't take a ticket. The invitation waits in the workspace menu if it was sent to this account.
    return (
      <Shell title="You are already signed in" subtitle="Your invitation is waiting in the app.">
        <p className="mb-5 text-[15px] text-[#3d5a73]">
          Open the workspace menu at the top of the page and select Join. If the invitation is not there, it was sent to a different email address, so sign out and open the link again.
        </p>
        <Link href={AFTER_JOIN_URL} className={linkBtnCls}>
          Open DaktariScribe
        </Link>
      </Shell>
    );
  }
  return status === 'sign_up' ? <NewAccount ticket={ticket} /> : <ExistingAccount ticket={ticket} />;
}
