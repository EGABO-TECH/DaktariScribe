'use client';

import React, { useState } from 'react';
import { downloadFile } from '@/lib/download';

/** A download button for a GET file route, with a busy state and an inline error. */
export default function DownloadButton({
  href,
  fallbackName,
  icon = 'download',
  children,
  className,
  busyLabel = 'Preparing…',
  errorText,
}: {
  href: string;
  fallbackName: string;
  icon?: string;
  children: React.ReactNode;
  className: string;
  busyLabel?: string;
  errorText?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    const r = await downloadFile(href, { fallbackName, errorText });
    if (!r.ok) setError(r.error);
    setBusy(false);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <button type="button" onClick={run} disabled={busy} aria-busy={busy} className={className}>
        <span className={`material-symbols-outlined ${busy ? 'animate-spin' : ''}`} aria-hidden="true">
          {busy ? 'progress_activity' : icon}
        </span>
        {busy ? busyLabel : children}
      </button>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}
