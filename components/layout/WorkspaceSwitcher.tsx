'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, useOrganization, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useDevice } from '@/components/offline/DeviceProvider';
import { useWorkspaces } from '@/components/organisation/use-workspaces';
import { organisationErrorMessage } from '@/lib/organisation-errors';
import { orgRoleLabel, orgToAutoActivate } from '@/lib/roles';

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
  const { isLoaded: listLoaded, setActive, userMemberships } = useWorkspaces();
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

const rowCls = 'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60';
const headingCls = 'px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant';

function Check({ show }: { show: boolean }) {
  return show ? (
    <span className="material-symbols-outlined ml-auto text-[20px] text-secondary" aria-hidden="true">
      check
    </span>
  ) : null;
}

export default function WorkspaceSwitcher() {
  const { pending } = useDevice();
  useAutoActivateNewOrg(pending);
  const { orgId } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { isLoaded, userMemberships, userInvitations, refreshLists, switchTo } = useWorkspaces();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
      setOpen(false);
    } catch (err) {
      setError(organisationErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const select = (id: string | null) => {
    if (id === (orgId ?? null)) return setOpen(false);
    void run(() => switchTo(id), 'The workspace could not be changed. Check your connection and try again.');
  };

  const memberships = userMemberships.data ?? [];
  const invitations = userInvitations.data ?? [];
  const activeName = organization?.name ?? 'Personal workspace';

  return (
    <div
      ref={rootRef}
      className="relative flex min-w-0 items-center"
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Workspace: ${activeName}. Change workspace`}
        className="relative flex h-12 min-w-0 max-w-[132px] items-center gap-1.5 rounded-lg border border-outline-variant px-2 text-[14px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high sm:max-w-[220px]"
      >
        <span className="material-symbols-outlined shrink-0 text-[20px] text-secondary" aria-hidden="true">
          {organization ? 'groups' : 'person'}
        </span>
        <span className="min-w-0 truncate">{activeName}</span>
        <span className="material-symbols-outlined shrink-0 text-[20px] text-on-surface-variant" aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </span>
        {invitations.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-[12px] font-bold text-on-secondary">
            <span className="sr-only">Invitations waiting: </span>
            {invitations.length}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="fixed inset-x-4 top-[4.25rem] z-50 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 md:max-h-[calc(100dvh-7rem)]"
        >
          {error && (
            <p role="alert" className="mb-2 rounded-lg border border-error bg-error-container p-3 text-[14px] text-on-error-container">
              {error}
            </p>
          )}

          <p className={headingCls}>Workspaces</p>
          <button type="button" disabled={busy || !isLoaded} onClick={() => select(null)} aria-current={!orgId || undefined} className={rowCls}>
            <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden="true">
              person
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">Personal workspace</span>
              <span className="block text-[13px] text-on-surface-variant">Only you</span>
            </span>
            <Check show={!orgId} />
          </button>
          {memberships.map((m) => (
            <button key={m.id} type="button" disabled={busy} onClick={() => select(m.organization.id)} aria-current={orgId === m.organization.id || undefined} className={rowCls}>
              <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden="true">
                groups
              </span>
              <span className="min-w-0">
                <span className="block font-semibold [overflow-wrap:anywhere]">{m.organization.name}</span>
                <span className="block text-[13px] text-on-surface-variant">{orgRoleLabel(m.role)}</span>
              </span>
              <Check show={orgId === m.organization.id} />
            </button>
          ))}
          {userMemberships.hasNextPage && (
            <button type="button" onClick={() => userMemberships.fetchNext?.()} className={`${rowCls} font-semibold text-secondary`}>
              Show more
            </button>
          )}

          {invitations.length > 0 && (
            <>
              <p className={`${headingCls} mt-1 border-t border-outline-variant pt-3`}>Invitations</p>
              {invitations.map((inv) => (
                <div key={inv.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-on-surface [overflow-wrap:anywhere]">{inv.publicOrganizationData.name}</span>
                    <span className="block text-[13px] text-on-surface-variant">{orgRoleLabel(inv.role)}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await inv.accept();
                        await refreshLists();
                        await switchTo(inv.publicOrganizationData.id);
                      }, 'The invitation could not be accepted. Check your connection and try again.')
                    }
                    className="min-h-12 shrink-0 rounded-lg bg-primary px-4 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-60"
                  >
                    Join
                  </button>
                </div>
              ))}
            </>
          )}

          <div className="mt-1 border-t border-outline-variant pt-1">
            {organization && (
              <Link href="/organisation" onClick={() => setOpen(false)} className={rowCls}>
                <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden="true">
                  settings
                </span>
                <span className="font-semibold">Manage organisation</span>
              </Link>
            )}
            {user?.createOrganizationEnabled && (
              <Link href="/organisation/new" onClick={() => setOpen(false)} className={rowCls}>
                <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden="true">
                  add
                </span>
                <span className="font-semibold">Create organisation</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
