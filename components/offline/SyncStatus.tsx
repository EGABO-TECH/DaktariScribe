'use client';

import React from 'react';
import { useDevice } from './DeviceProvider';
import { useOnline } from '@/components/layout/OfflineBanner';

/** Header chip: pending-sync count and a "Sync now" button (spec §1.4, §5 Phase 4.7). */
export default function SyncStatus() {
  const { pending, syncing, syncNow, unlocked } = useDevice();
  const online = useOnline();
  if (!pending && online) return null;
  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      disabled={!online || syncing || !unlocked}
      title={!unlocked ? 'Unlock the device to sync' : online ? 'Sync now' : 'Waiting for connection'}
      className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-outline px-3 text-[13px] font-semibold text-on-surface hover:bg-surface-container-high disabled:cursor-default"
    >
      <span className={`material-symbols-outlined text-[20px] ${syncing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true">
        {online ? 'sync' : 'cloud_off'}
      </span>
      <span>
        {pending} pending
        <span className="sr-only">{online ? ', select to sync now' : ', waiting for connection'}</span>
      </span>
    </button>
  );
}
