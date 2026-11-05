'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type Me = {
  enforced: boolean;
  pass?: { name: string; endsAt: string; reportsLeft: number } | null;
  warnings?: string[];
};

function daysLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 24 * 3600 * 1000) return 'last day';
  const d = Math.ceil(ms / (24 * 3600 * 1000));
  return `${d} days`;
}

/** "Weekly pass · 4 days · 9 reports left" — opens /billing (spec §7.6). */
export default function PassChip() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/billing/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setMe(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!me?.enforced) return null;
  const warn = (me.warnings?.length ?? 0) > 0;
  return (
    <Link
      href="/billing"
      className={`hidden min-h-12 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold sm:inline-flex ${
        !me.pass ? 'border-error text-error' : warn ? 'border-flag bg-flag-container text-on-flag-container' : 'border-outline text-on-surface'
      } hover:bg-surface-container-high`}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
        {me.pass ? 'confirmation_number' : 'error'}
      </span>
      {me.pass ? `${me.pass.name} · ${daysLeft(me.pass.endsAt)} · ${me.pass.reportsLeft} reports left` : 'No active pass'}
    </Link>
  );
}
