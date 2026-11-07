'use client';

/**
 * Checkout (spec §7.3): pick a product, pay with MTN/Airtel mobile money (PIN prompt on the
 * phone, 2-minute countdown while we poll) or card/bank via the hosted payment page.
 * The price shown is informational; the server always derives the amount itself.
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DownloadButton from '@/components/ui/DownloadButton';

type Product = { code: string; name: string; priceUgx: number; detail: string; perSeat: boolean };
type Phase = { kind: 'choose' } | { kind: 'waiting'; reference: string; deadline: number } | { kind: 'done'; reference: string } | { kind: 'failed'; message: string };

const ugx = (n: number) => `UGX ${new Intl.NumberFormat('en-UG').format(n)}`;
const fieldCls = 'w-full min-h-12 rounded-lg border border-outline bg-surface-container-lowest px-3 text-[16px] text-on-surface';

export default function BuyFlow({ products, initial }: { products: Product[]; initial: string }) {
  const [code, setCode] = useState(initial);
  const [method, setMethod] = useState<'mobileMoney' | 'card'>('mobileMoney');
  const [phone, setPhone] = useState('');
  const [seats, setSeats] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'choose' });
  const [now, setNow] = useState(0);
  const selected = products.find((p) => p.code === code)!;
  const total = selected.perSeat ? selected.priceUgx * Math.max(5, seats) : selected.priceUgx;

  useEffect(() => {
    if (phase.kind !== 'waiting') return;
    let stop = false;
    const tick = async () => {
      setNow(Date.now());
      try {
        const res = await fetch(`/api/billing/payments/${phase.reference}`);
        const data = await res.json();
        if (data.status === 'successful') return setPhase({ kind: 'done', reference: phase.reference });
        if (data.status === 'failed' || data.status === 'cancelled')
          return setPhase({ kind: 'failed', message: 'The payment was not completed. No money was taken. You can try again.' });
      } catch {
        /* keep polling */
      }
      if (!stop && Date.now() < phase.deadline + 60_000) setTimeout(tick, 4000);
      else if (!stop) setPhase({ kind: 'failed', message: 'We did not get a confirmation yet. If you approved it, your pass will appear on the Billing page within a few minutes.' });
    };
    const t = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [phase]);

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productCode: code, method, phone: method === 'mobileMoney' ? phone : undefined, seats: selected.perSeat ? seats : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? 'The payment could not be started.');
      if (data.method === 'card' && data.url) {
        window.location.href = data.url;
        return;
      }
      setPhase({ kind: 'waiting', reference: data.reference, deadline: Date.now() + 120_000 });
    } catch {
      setError('Connection lost. Nothing was charged. Try again when you are back online.');
    } finally {
      setBusy(false);
    }
  };

  if (phase.kind === 'waiting') {
    const left = Math.max(0, Math.ceil((phase.deadline - (now || phase.deadline - 120_000)) / 1000));
    return (
      <section role="status" aria-live="polite" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center">
        <span className="material-symbols-outlined text-[40px] text-secondary" aria-hidden="true">
          smartphone
        </span>
        <h2 className="mt-2 font-headline-sm text-headline-sm text-primary">Check your phone and enter your Mobile Money PIN</h2>
        <p className="mt-1 text-body-md text-on-surface">
          {selected.name} · {ugx(total)}
        </p>
        <p className="mt-3 font-label-status text-[24px] font-semibold text-on-surface">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </p>
        <p className="text-[13px] text-on-surface-variant">Waiting for your approval…</p>
      </section>
    );
  }
  if (phase.kind === 'done') {
    return (
      <section className="rounded-xl border border-secondary bg-success-container p-6 text-on-success-container">
        <h2 className="font-headline-sm text-headline-sm">Payment received</h2>
        <p className="mt-1">Your {selected.name.toLowerCase()} is active.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="flex-none">
            <DownloadButton
              href={`/api/billing/receipts/${phase.reference}`}
              fallbackName="DaktariScribe-receipt.pdf"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-secondary px-4 font-semibold text-on-secondary disabled:opacity-60"
            >
              Download receipt
            </DownloadButton>
          </div>
          <Link href="/field-entry" className="inline-flex min-h-12 items-center rounded-lg px-4 font-semibold underline">
            Back to Field Entry
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-gutter">
      {phase.kind === 'failed' && (
        <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-on-error-container">
          {phase.message}
        </p>
      )}
      <fieldset className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <legend className="px-1 font-semibold text-primary">Choose</legend>
        <div className="flex flex-col gap-2">
          {products.map((p) => (
            <label key={p.code} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg border border-outline px-3 py-2 has-[:checked]:border-secondary has-[:checked]:bg-success-container">
              <span className="flex items-center gap-3">
                <input type="radio" name="product" value={p.code} checked={code === p.code} onChange={() => setCode(p.code)} className="h-5 w-5 accent-[var(--color-secondary)]" />
                <span>
                  <span className="block font-semibold text-on-surface">{p.name}</span>
                  <span className="block text-[13px] text-on-surface-variant">{p.detail}</span>
                </span>
              </span>
              <span className="whitespace-nowrap font-semibold text-on-surface">
                {ugx(p.priceUgx)}
                {p.perSeat ? ' / seat' : ''}
              </span>
            </label>
          ))}
        </div>
        {selected.perSeat && (
          <div className="mt-3 max-w-xs">
            <label htmlFor="seats" className="mb-1 block text-[13px] font-semibold text-on-surface">
              Number of health workers (minimum 5)
            </label>
            <input id="seats" type="number" min={5} max={500} value={seats} onChange={(e) => setSeats(Number(e.target.value))} className={fieldCls} />
          </div>
        )}
      </fieldset>

      <fieldset className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <legend className="px-1 font-semibold text-primary">Pay with</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-outline px-3 has-[:checked]:border-secondary has-[:checked]:bg-success-container">
            <input type="radio" name="method" checked={method === 'mobileMoney'} onChange={() => setMethod('mobileMoney')} className="h-5 w-5 accent-[var(--color-secondary)]" />
            <span className="font-semibold text-on-surface">MTN or Airtel Mobile Money</span>
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-outline px-3 has-[:checked]:border-secondary has-[:checked]:bg-success-container">
            <input type="radio" name="method" checked={method === 'card'} onChange={() => setMethod('card')} className="h-5 w-5 accent-[var(--color-secondary)]" />
            <span className="font-semibold text-on-surface">Card or bank transfer</span>
          </label>
        </div>
        {method === 'mobileMoney' ? (
          <div className="mt-3 max-w-sm">
            <label htmlFor="phone" className="mb-1 block text-[13px] font-semibold text-on-surface">
              Mobile money number
            </label>
            <input id="phone" inputMode="tel" autoComplete="tel" placeholder="0772 123456" value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldCls} />
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-on-surface-variant">You will be taken to a secure Nylon Pay page. Card details never reach DaktariScribe.</p>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-on-error-container">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-body-lg text-on-surface">
          Total <strong>{ugx(total)}</strong> · one-off, does not renew
        </p>
        <button type="button" onClick={pay} disabled={busy} className="min-h-12 rounded-lg bg-primary px-6 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-60">
          {busy ? 'Starting…' : `Pay ${ugx(total)}`}
        </button>
      </div>
    </div>
  );
}
