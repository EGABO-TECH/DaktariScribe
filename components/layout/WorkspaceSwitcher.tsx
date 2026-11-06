'use client';

import React, { useEffect } from 'react';
import { OrganizationSwitcher, useAuth, useOrganizationList } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useDevice } from '@/components/offline/DeviceProvider';
import { orgToAutoActivate } from '@/lib/roles';

const AFTER_SWITCH_URL = '/field-entry';

function readSeen(key: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return null;
  }
}

function writeSeen(key: string, ids: string[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens an organisation by itself the first time this device sees it, so someone who has just
 * accepted an invitation records into their team without needing to find the switcher.
 */
function useAutoActivateNewOrg(pending: number) {
  const router = useRouter();
  const { isLoaded: authLoaded, userId, orgId } = useAuth();
  const { isLoaded: listLoaded, setActive, userMemberships } = useOrganizationList({ userMemberships: true });
  const loading = !authLoaded || !listLoaded || userMemberships.isLoading;
  const memberOrgIds = (userMemberships.data ?? []).map((m) => m.organization.id).join(',');

  useEffect(() => {
    if (loading || !userId || !memberOrgIds) return;
    const key = `ds-orgs-seen:${userId}`;
    const seen = readSeen(key);
    if (seen === null) return;
    const ids = memberOrgIds.split(',');
    const target = orgToAutoActivate({ activeOrgId: orgId, memberOrgIds: ids, seenOrgIds: seen });
    // While someone works in an organisation they can already see the rest in the switcher.
    if (orgId) {
      writeSeen(key, [...new Set([...seen, ...ids])]);
      return;
    }
    // Queued records upload to the active workspace, so nothing moves until they have gone.
    if (!target || pending > 0 || !navigator.onLine) return;
    if (!writeSeen(key, [...new Set([...seen, ...ids])])) return;
    setActive?.({ organization: target })
      .then(() => router.refresh())
      .catch(() => {
        /* stays in the personal workspace; the switcher still works */
      });
  }, [loading, userId, orgId, memberOrgIds, pending, setActive, router]);
}

export default function WorkspaceSwitcher() {
  const { pending } = useDevice();
  useAutoActivateNewOrg(pending);

  // Queued records upload to whichever workspace is active, so a switch could send them to the wrong one.
  if (pending > 0) {
    const message = 'Upload or discard the records waiting on this device to switch workspace.';
    return (
      <span title={message} className="flex h-12 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-on-surface-variant">
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          lock
        </span>
        <span className="sr-only">{message}</span>
        <span className="hidden xl:inline" aria-hidden="true">
          Workspace locked
        </span>
      </span>
    );
  }

  return (
    <div className="ds-workspace-switcher flex min-w-0 items-center">
      <OrganizationSwitcher
        afterSelectOrganizationUrl={AFTER_SWITCH_URL}
        afterSelectPersonalUrl={AFTER_SWITCH_URL}
        afterCreateOrganizationUrl={AFTER_SWITCH_URL}
        afterLeaveOrganizationUrl={AFTER_SWITCH_URL}
      />
    </div>
  );
}
