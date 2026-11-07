'use client';

/**
 * Recovery from leftover sessions. Clerk refuses to start a new sign-in or sign-up
 * ("You're already signed in", code session_exists) while this browser still holds a session,
 * including a *pending* one (for example from when organisation membership was required) that
 * the app itself treats as signed out. These helpers clear it properly.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export function isSessionExistsError(err: unknown): boolean {
  const e = err as { errors?: Array<{ code?: string }> } | null;
  return Boolean(e?.errors?.some((x) => x.code === 'session_exists' || x.code === 'identifier_already_signed_in'));
}

/** Clears device data (drafts, offline queue, PIN key) and every Clerk session in this browser. */
export async function clearDeviceAndSessions(signOut: () => Promise<void>): Promise<void> {
  try {
    const [{ lock }, { wipeDevice }] = await Promise.all([import('@/lib/offline/crypto'), import('@/lib/offline/db')]);
    lock();
    await wipeDevice();
  } catch {
    /* IndexedDB unavailable: nothing stored on this device */
  }
  await signOut();
}

/**
 * Runs a Clerk sign-in/sign-up call; if a leftover session blocks it, signs out that session
 * (Clerk only; device drafts are kept) and tries once more.
 */
export function useRetryAfterStaleSession() {
  const { signOut } = useClerk();
  return useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (err) {
        if (!isSessionExistsError(err)) throw err;
        await signOut();
        return action();
      }
    },
    [signOut],
  );
}

/**
 * On public auth pages: sends someone who is really signed in to the app, and offers a clean
 * sign-out when only a leftover (pending) session is present.
 */
export function ExistingSessionNotice() {
  const router = useRouter();
  const { signOut } = useClerk();
  const active = useAuth();
  const any = useAuth({ treatPendingAsSignedOut: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (active.isLoaded && active.isSignedIn) router.replace('/field-entry');
  }, [active.isLoaded, active.isSignedIn, router]);

  if (!any.isLoaded || !any.isSignedIn || active.isSignedIn) return null;

  return (
    <div role="alert" className="mb-5 rounded-xl border border-[#f2c97d] bg-[#fef3c7] p-4 text-[14px] text-[#78350f]">
      <p className="font-semibold">An unfinished sign-in is still open on this device.</p>
      <p className="mt-1">Sign it out to continue. Your drafts on this device are kept.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await signOut();
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex min-h-11 items-center rounded-lg bg-[#0d2240] px-4 font-semibold text-white hover:bg-[#1a3a5c] disabled:opacity-60"
        >
          {busy ? 'Signing out…' : 'Sign out and continue'}
        </button>
        <Link href="/sign-out" className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-[#78350f] underline-offset-2 hover:underline">
          More sign-out options
        </Link>
      </div>
    </div>
  );
}
