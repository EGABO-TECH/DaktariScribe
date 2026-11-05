'use client';

import React, { useState } from 'react';
import { useDevice } from './DeviceProvider';

const inputCls =
  'w-full min-h-12 rounded-lg border border-outline bg-surface-container-lowest px-3 text-center text-[24px] tracking-[0.5em] text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30';

/** Shows a PIN set-up or unlock form until the device is unlocked, then renders children. */
export default function PinGate({ children }: { children: React.ReactNode }) {
  const { unlocked, hasPin, setPin, unlockWithPin } = useDevice();
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (unlocked) return <>{children}</>;
  if (hasPin === null) {
    return <p className="p-6 text-on-surface-variant">Preparing this device…</p>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4,8}$/.test(pin)) return setError('Use 4 to 8 digits.');
    setBusy(true);
    try {
      if (!hasPin) {
        if (pin !== confirm) return setError('The two PINs do not match.');
        await setPin(pin);
      } else if (!(await unlockWithPin(pin))) {
        setError(navigator.onLine ? 'That PIN is not correct.' : 'That PIN is not correct, or your session has expired. Sign in again when online.');
      }
    } finally {
      setBusy(false);
      setPinValue('');
      setConfirm('');
    }
  };

  return (
    <section className="mx-auto w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6" aria-labelledby="pin-title">
      <span className="material-symbols-outlined text-[32px] text-secondary" aria-hidden="true">
        lock
      </span>
      <h2 id="pin-title" className="mt-2 font-headline-sm text-headline-sm text-primary">
        {hasPin ? 'Unlock this device' : 'Protect notes on this device'}
      </h2>
      <p className="mt-1 text-body-md text-on-surface-variant">
        {hasPin
          ? 'Enter your PIN to open drafts and recordings saved on this device.'
          : 'Choose a PIN. Notes, recordings and files saved on this device are encrypted with it. It locks after 10 minutes without use.'}
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="text-[13px] font-semibold text-on-surface" htmlFor="pin">
          PIN
        </label>
        <input id="pin" className={inputCls} inputMode="numeric" autoComplete="off" type="password" maxLength={8} value={pin} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))} autoFocus />
        {!hasPin && (
          <>
            <label className="text-[13px] font-semibold text-on-surface" htmlFor="pin2">
              Repeat PIN
            </label>
            <input id="pin2" className={inputCls} inputMode="numeric" autoComplete="off" type="password" maxLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))} />
          </>
        )}
        {error && (
          <p role="alert" className="text-[14px] font-semibold text-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="min-h-12 rounded-lg bg-primary px-5 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-60">
          {busy ? 'Please wait…' : hasPin ? 'Unlock' : 'Set PIN'}
        </button>
      </form>
    </section>
  );
}
