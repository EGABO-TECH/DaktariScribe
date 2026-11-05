'use client';

import React, { useSyncExternalStore } from 'react';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Always-visible banner while offline (spec §1.4). */
export default function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 bg-flag-container text-on-flag-container border-b border-flag px-4 py-2 text-[14px] font-medium shrink-0"
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
        wifi_off
      </span>
      You are offline. Notes you type are saved on this device and can be processed when you reconnect.
    </div>
  );
}
