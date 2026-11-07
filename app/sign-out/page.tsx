'use client';

/**
 * /sign-out: a dependable way to sign out of this device, reachable even when the app's own
 * screens can't be opened (for example with a leftover session that blocks signing in).
 */
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { clearDeviceAndSessions } from '@/components/auth/session-recovery';

type State = 'idle' | 'working' | 'done' | 'error';

export default function SignOutPage() {
  const { signOut, loaded } = useClerk();
  const any = useAuth({ treatPendingAsSignedOut: false });
  const [state, setState] = useState<State>('idle');
  const [pending, setPending] = useState(0);

  useEffect(() => {
    import('@/lib/offline/outbox')
      .then(({ pendingCount }) => pendingCount())
      .then(setPending)
      .catch(() => setPending(0));
  }, []);

  const run = async (wipe: boolean) => {
    setState('working');
    try {
      if (wipe) await clearDeviceAndSessions(() => signOut());
      else await signOut();
      setState('done');
    } catch {
      setState('error');
    }
  };

  const signedIn = any.isLoaded && any.isSignedIn;

  return (
    <main className="force-light flex min-h-screen items-center justify-center bg-[#eef6f5] px-4 py-10">
      <div className="w-full max-w-[460px] overflow-hidden rounded-3xl border border-[#d0e8e4] bg-white shadow-2xl shadow-[rgba(0,185,150,0.10)]">
        <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center" style={{ background: 'linear-gradient(145deg, #0d2240 0%, #1a3a5c 60%, #00956e 100%)' }}>
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-lg">
            <Image src="/assets/DaktariScribe-Favicon.png" alt="" width={48} height={48} priority />
          </span>
          <h1 className="text-[22px] font-extrabold text-white">Sign out of this device</h1>
          <p className="mt-1 text-[13px] text-[#a8f0e6]">Ends every DaktariScribe session in this browser.</p>
        </div>

        <div className="space-y-4 px-6 py-7 text-[14px] text-[#3d5a73]">
          {state === 'done' ? (
            <div role="status" className="space-y-4 text-center">
              <span className="material-symbols-outlined text-[44px] text-[#00956e]" aria-hidden="true">
                check_circle
              </span>
              <p className="text-[16px] font-semibold text-[#0d2240]">You are signed out.</p>
              <p>You can now sign in or create an account without any leftover session getting in the way.</p>
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#0d2240] font-bold text-white hover:bg-[#1a3a5c]">
                  Go to sign in
                </Link>
                <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-xl font-semibold text-[#00956e] hover:bg-[#e0faf5]">
                  Create an account
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p>
                {!loaded || !any.isLoaded
                  ? 'Checking this device…'
                  : signedIn
                    ? 'A session is open on this device. Choose how to sign out:'
                    : 'No active session was found, but you can still clear this device to be sure.'}
              </p>

              {pending > 0 && (
                <p role="alert" className="rounded-xl border border-[#f2c97d] bg-[#fef3c7] p-3 font-semibold text-[#78350f]">
                  {pending} encounter(s) on this device have not uploaded yet. &quot;Sign out and clear this device&quot; deletes them.
                </p>
              )}

              {state === 'error' && (
                <p role="alert" className="rounded-xl border border-[#f5b5ae] bg-[#ffdad6] p-3 text-[#93000a]">
                  Sign-out did not finish. Check your connection and try again.
                </p>
              )}

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={state === 'working' || !loaded}
                  onClick={() => run(false)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0d2240] font-bold text-white hover:bg-[#1a3a5c] disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    logout
                  </span>
                  {state === 'working' ? 'Signing out…' : 'Sign out (keep drafts on this device)'}
                </button>
                <button
                  type="button"
                  disabled={state === 'working' || !loaded}
                  onClick={() => {
                    if (pending > 0 && !window.confirm(`${pending} encounter(s) have not uploaded yet and will be deleted. Continue?`)) return;
                    void run(true);
                  }}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#d0e8e4] font-semibold text-[#0d2240] hover:bg-[#f0f7f6] disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    delete_sweep
                  </span>
                  Sign out and clear this device
                </button>
                <Link href="/" className="inline-flex min-h-11 items-center justify-center text-[13px] font-semibold text-[#3d5a73] hover:text-[#00b896]">
                  Cancel
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
