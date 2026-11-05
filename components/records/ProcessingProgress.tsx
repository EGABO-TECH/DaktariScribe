'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'transcribing', label: 'Transcribing' },
  { key: 'organising', label: 'Organising' },
  { key: 'ready', label: 'Ready for review' },
] as const;

type Step = (typeof STEPS)[number]['key'];

/** Determinate progress with plain steps (spec §1.5): polls status and refreshes when ready. */
export default function ProcessingProgress({ recordId, initialStep }: { recordId: string; initialStep: Step }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/encounters/${encodeURIComponent(recordId)}/status`);
        if (res.ok) {
          const data = (await res.json()) as { step: Step; sources: { status: string; error: string | null }[] };
          setStep(data.step);
          setFailed(data.sources.filter((s) => s.status === 'failed' && s.error).map((s) => s.error!));
          if (data.step === 'ready') {
            router.refresh();
            return;
          }
        }
      } catch {
        /* offline: keep waiting */
      }
      if (!stop) setTimeout(tick, 3000);
    };
    const t = setTimeout(tick, 1500);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [recordId, router]);

  const current = STEPS.findIndex((s) => s.key === step);
  return (
    <div className="flex flex-col gap-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={current + 1} aria-label="Processing progress">
        <div className="h-full rounded-full bg-secondary transition-[width] duration-200" style={{ width: `${((current + 1) / STEPS.length) * 100}%` }} />
      </div>
      <ol className="flex flex-wrap gap-2 text-[13px]">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${i <= current ? 'border-secondary bg-success-container text-on-success-container' : 'border-outline-variant text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              {i < current ? 'check_circle' : i === current ? 'radio_button_checked' : 'radio_button_unchecked'}
            </span>
            {s.label}
          </li>
        ))}
      </ol>
      {failed.map((f) => (
        <p key={f} className="text-[14px] text-error">
          {f}
        </p>
      ))}
    </div>
  );
}
