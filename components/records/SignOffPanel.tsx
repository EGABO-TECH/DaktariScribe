'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOffBlocker } from '@/lib/encounter-status';
import type { EncounterStatus } from '@/db/schema';

export default function SignOffPanel({
  recordId,
  versionId,
  versionNo,
  status,
  isAuthor,
  statement,
}: {
  recordId: string;
  versionId: string;
  versionNo: number;
  status: EncounterStatus;
  isAuthor: boolean;
  statement: string;
}) {
  const router = useRouter();
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const blocker = signOffBlocker({ status, isAuthor, hasVersion: true, attested });

  const submit = async () => {
    if (blocker) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/encounters/${encodeURIComponent(recordId)}/signoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId, attested }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Sign-off failed. Please try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Connection lost. Sign-off was not saved. Try again when you are back online.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthor) {
    return (
      <p className="text-body-md text-on-surface-variant">
        Waiting for the author to review and sign off this record.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-outline p-3 has-[:checked]:border-secondary has-[:checked]:bg-success-container">
        <input
          type="checkbox"
          className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-secondary)]"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
        />
        <span className="text-[15px] text-on-surface">
          {statement} <span className="text-on-surface-variant">(version {versionNo})</span>
        </span>
      </label>
      {error && (
        <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-[14px] text-on-error-container">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!!blocker || busy}
        aria-describedby={blocker ? 'signoff-hint' : undefined}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-secondary px-6 font-semibold text-on-secondary hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {busy ? 'hourglass_top' : 'verified'}
        </span>
        {busy ? 'Signing off…' : 'Sign off and make final'}
      </button>
      {blocker && (
        <p id="signoff-hint" className="text-[13px] text-on-surface-variant">
          {blocker}
        </p>
      )}
    </div>
  );
}
