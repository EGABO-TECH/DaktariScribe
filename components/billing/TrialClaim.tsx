'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Free trial: once per account and per phone number (spec §7.2). */
export default function TrialClaim({ defaultPhone }: { defaultPhone: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const claim = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    let deviceId = '';
    try {
      deviceId = localStorage.getItem('ds-device') ?? crypto.randomUUID();
      localStorage.setItem('ds-device', deviceId);
    } catch {
      /* storage unavailable */
    }
    const res = await fetch('/api/billing/trial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, deviceId }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? 'The trial could not be started.');
    router.refresh();
  };

  return (
    <section aria-labelledby="trial-h" className="rounded-xl border border-secondary bg-success-container p-4 text-on-success-container md:p-6">
      <h2 id="trial-h" className="font-headline-sm text-headline-sm">
        Start your free 7-day trial
      </h2>
      <p className="mt-1 text-body-md">10 reports and 20 voice minutes. One trial per account and phone number. No payment needed.</p>
      <form onSubmit={claim} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="trial-phone" className="mb-1 block text-[13px] font-semibold">
            Mobile number
          </label>
          <input
            id="trial-phone"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0772 123456"
            className="w-full min-h-12 rounded-lg border border-outline bg-surface-container-lowest px-3 text-[16px] text-on-surface"
          />
        </div>
        <button type="submit" disabled={busy} className="min-h-12 rounded-lg bg-secondary px-5 font-semibold text-on-secondary disabled:opacity-60">
          {busy ? 'Starting…' : 'Start trial'}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 font-semibold text-error">
          {error}
        </p>
      )}
    </section>
  );
}
