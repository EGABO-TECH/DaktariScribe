'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, useOrganization, useUser } from '@clerk/nextjs';
import type { OrganizationMembershipResource, OrganizationResource } from '@clerk/nextjs/types';
import { useRouter } from 'next/navigation';
import { useDevice } from '@/components/offline/DeviceProvider';
import { organisationErrorMessage } from '@/lib/organisation-errors';
import { canManageTeam, INVITABLE_ROLES, orgRoleHelp, orgRoleLabel, workspaceAccess } from '@/lib/roles';
import { AFTER_SWITCH_URL, useWorkspaces } from './use-workspaces';
import { cardCls, dangerBtnCls, errorCls, fieldCls, headingCls, labelCls, primaryBtnCls, secondaryBtnCls, successCls } from './styles';

const LOCKED_NOTE = 'Upload or discard the records waiting on this device first. Otherwise they could be saved to the wrong workspace.';

const memberOptions = { infinite: true as const, pageSize: 20, keepPreviousData: true };
const invitationOptions = { infinite: true as const, pageSize: 20, keepPreviousData: true, status: ['pending' as const] };

function memberName(m: OrganizationMembershipResource): string {
  const d = m.publicUserData;
  return [d?.firstName, d?.lastName].filter(Boolean).join(' ') || d?.identifier || 'Unknown member';
}

/** The role keys this organisation can actually assign. Without the supervisor role in Clerk, it isn't offered. */
function useAssignableRoles(organization: OrganizationResource, enabled: boolean) {
  const [state, setState] = useState<{ roles: string[]; locked: boolean }>({ roles: [], locked: false });
  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    organization
      .getRoles({ pageSize: 20 })
      .then((res) => {
        if (stale) return;
        const available = res.data.map((r) => r.key);
        setState({ roles: INVITABLE_ROLES.filter((k) => available.includes(k)), locked: Boolean(res.has_role_set_migration) });
      })
      .catch(() => {
        if (!stale) setState({ roles: ['org:member', 'org:admin'], locked: false });
      });
    return () => {
      stale = true;
    };
  }, [organization, enabled]);
  return state;
}

function DetailsSection({ organization, canManage, roleLabel }: { organization: OrganizationResource; canManage: boolean; roleLabel: string }) {
  const router = useRouter();
  const { refreshLists } = useWorkspaces();
  const [name, setName] = useState(organization.name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const trimmed = name.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trimmed.length < 2) return setMessage({ ok: false, text: 'Enter a name with at least 2 characters.' });
    setBusy(true);
    setMessage(null);
    try {
      await organization.update({ name: trimmed });
      await refreshLists();
      router.refresh();
      setMessage({ ok: true, text: 'Name saved.' });
    } catch (err) {
      setMessage({ ok: false, text: organisationErrorMessage(err, 'The name could not be saved. Check your connection and try again.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="org-details-h" className={cardCls}>
      <h2 id="org-details-h" className={headingCls}>
        Details
      </h2>
      <p className="mt-1 text-body-md text-on-surface-variant">
        Your role: <strong className="text-on-surface">{roleLabel}</strong>
      </p>
      {canManage && (
        <form onSubmit={save} noValidate className="mt-4 flex max-w-xl flex-col gap-3">
          {message && (
            <p role={message.ok ? 'status' : 'alert'} className={message.ok ? successCls : errorCls}>
              {message.text}
            </p>
          )}
          <div>
            <label htmlFor="org-rename" className={labelCls}>
              Organisation name
            </label>
            <input id="org-rename" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={fieldCls} />
          </div>
          <div>
            <button type="submit" disabled={busy || trimmed === organization.name} className={primaryBtnCls}>
              {busy ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function InviteSection({ roles, onInvited }: { roles: string[]; onInvited: () => Promise<unknown> | undefined }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('org:member');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) return setMessage({ ok: false, text: 'Enter a valid email address.' });
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/organisation/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAddress: address, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setMessage({ ok: false, text: data.error ?? 'The invitation could not be sent.' });
      setEmail('');
      setMessage({ ok: true, text: `Invitation sent to ${address}.` });
      await onInvited();
    } catch {
      setMessage({ ok: false, text: 'Connection lost. Try again when you are back online.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="org-invite-h" className={cardCls}>
      <h2 id="org-invite-h" className={headingCls}>
        Invite someone
      </h2>
      <form onSubmit={submit} noValidate className="mt-3 flex flex-col gap-3">
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={message.ok ? successCls : errorCls}>
            {message.text}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="invite-email" className={labelCls}>
              Email address
            </label>
            <input id="invite-email" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="invite-role" className={labelCls}>
              Role
            </label>
            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)} aria-describedby="invite-role-help" className={fieldCls}>
              {(roles.length ? roles : ['org:member']).map((k) => (
                <option key={k} value={k}>
                  {orgRoleLabel(k)}
                </option>
              ))}
            </select>
            <p id="invite-role-help" className="mt-1 text-[13px] text-on-surface-variant">
              {orgRoleHelp(role)}
            </p>
          </div>
        </div>
        <div>
          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? 'Sending…' : 'Send invitation'}
          </button>
        </div>
      </form>
    </section>
  );
}

function MemberRow({
  member,
  isSelf,
  canManage,
  roles,
  rolesLocked,
  onChanged,
}: {
  member: OrganizationMembershipResource;
  isSelf: boolean;
  canManage: boolean;
  roles: string[];
  rolesLocked: boolean;
  onChanged: () => Promise<unknown> | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const name = memberName(member);
  const options = roles.includes(member.role) ? roles : [member.role, ...roles];

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(organisationErrorMessage(err, fallback));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className="flex flex-col gap-2 border-b border-outline-variant/60 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 basis-48">
          <p className="truncate font-semibold text-on-surface">
            {name}
            {isSelf ? <span className="font-normal text-on-surface-variant"> (you)</span> : null}
          </p>
          {member.publicUserData?.identifier && name !== member.publicUserData.identifier ? (
            <p className="truncate text-[13px] text-on-surface-variant">{member.publicUserData.identifier}</p>
          ) : null}
        </div>
        {canManage && !isSelf && !rolesLocked && roles.length > 0 ? (
          <div className="w-full sm:w-44">
            <label htmlFor={`role-${member.id}`} className="sr-only">
              Role for {name}
            </label>
            <select
              id={`role-${member.id}`}
              value={member.role}
              disabled={busy}
              onChange={(e) => void run(() => member.update({ role: e.target.value }), 'The role could not be changed. Check your connection and try again.')}
              className={fieldCls}
            >
              {options.map((k) => (
                <option key={k} value={k}>
                  {orgRoleLabel(k)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="text-[14px] font-semibold text-on-surface-variant">{orgRoleLabel(member.role)}</span>
        )}
        {canManage && !isSelf && !confirming && (
          <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={secondaryBtnCls}>
            Remove
          </button>
        )}
      </div>
      {confirming && (
        <div role="group" aria-label={`Confirm removing ${name}`} className={`${errorCls} flex flex-wrap items-center gap-3`}>
          <p className="min-w-0 flex-1 basis-56">Remove {name}? They will lose access to this organisation&apos;s records.</p>
          <button type="button" disabled={busy} onClick={() => void run(() => member.destroy(), 'This member could not be removed. Check your connection and try again.')} className={dangerBtnCls}>
            {busy ? 'Removing…' : 'Remove'}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryBtnCls}>
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className={errorCls}>
          {error}
        </p>
      )}
    </li>
  );
}

function TeamSections({ organization, canManage, canList }: { organization: OrganizationResource; canManage: boolean; canList: boolean }) {
  const { userId } = useAuth();
  const { memberships, invitations } = useOrganization({
    memberships: canList ? memberOptions : undefined,
    invitations: canManage ? invitationOptions : undefined,
  });
  const { roles, locked } = useAssignableRoles(organization, canManage);
  const [revokeError, setRevokeError] = useState('');

  const revoke = async (revokeInvitation: () => Promise<unknown>) => {
    setRevokeError('');
    try {
      await revokeInvitation();
      await invitations?.revalidate?.();
    } catch (err) {
      setRevokeError(organisationErrorMessage(err, 'The invitation could not be cancelled. Check your connection and try again.'));
    }
  };

  return (
    <>
      {canManage && <InviteSection roles={roles} onInvited={() => invitations?.revalidate?.()} />}

      {canManage && (invitations?.data?.length ?? 0) > 0 && (
        <section aria-labelledby="org-pending-h" className={cardCls}>
          <h2 id="org-pending-h" className={headingCls}>
            Pending invitations
          </h2>
          {revokeError && (
            <p role="alert" className={`${errorCls} mt-3`}>
              {revokeError}
            </p>
          )}
          <ul className="mt-2">
            {invitations?.data?.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 border-b border-outline-variant/60 py-3 last:border-b-0">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate font-semibold text-on-surface">{inv.emailAddress}</p>
                  <p className="text-[13px] text-on-surface-variant">{orgRoleLabel(inv.role)}</p>
                </div>
                <button type="button" onClick={() => void revoke(() => inv.revoke())} className={secondaryBtnCls}>
                  Cancel invitation
                </button>
              </li>
            ))}
          </ul>
          {invitations?.hasNextPage && (
            <button type="button" onClick={() => invitations.fetchNext?.()} className={`${secondaryBtnCls} mt-3`}>
              Show more
            </button>
          )}
        </section>
      )}

      {canList && (
        <section aria-labelledby="org-members-h" className={cardCls}>
          <h2 id="org-members-h" className={headingCls}>
            Members
          </h2>
          {memberships?.error ? (
            <p role="alert" className={`${errorCls} mt-3`}>
              The member list could not be loaded. Check your connection and reload the page.
            </p>
          ) : memberships?.isLoading ? (
            <p className="mt-3 text-on-surface-variant">Loading members…</p>
          ) : (
            <ul className="mt-2">
              {memberships?.data?.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isSelf={m.publicUserData?.userId === userId}
                  canManage={canManage}
                  roles={roles}
                  rolesLocked={locked}
                  onChanged={() => memberships.revalidate?.()}
                />
              ))}
            </ul>
          )}
          {memberships?.hasNextPage && (
            <button type="button" onClick={() => memberships.fetchNext?.()} className={`${secondaryBtnCls} mt-3`}>
              Show more
            </button>
          )}
        </section>
      )}
    </>
  );
}

function LeaveOrDeleteSection({ organization, canDelete }: { organization: OrganizationResource; canDelete: boolean }) {
  const { user } = useUser();
  const { pending } = useDevice();
  const { refreshLists, switchTo } = useWorkspaces();
  const [mode, setMode] = useState<'idle' | 'leave' | 'delete'>('idle');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = pending > 0;

  const finish = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await switchTo(null, AFTER_SWITCH_URL);
      await refreshLists();
    } catch (err) {
      setError(organisationErrorMessage(err, fallback));
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="org-leave-h" className={cardCls}>
      <h2 id="org-leave-h" className={headingCls}>
        Leave or delete
      </h2>
      {locked && <p className={`${errorCls} mt-3`}>{LOCKED_NOTE}</p>}
      {error && (
        <p role="alert" className={`${errorCls} mt-3`}>
          {error}
        </p>
      )}
      {mode === 'idle' && (
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={locked} onClick={() => setMode('leave')} className={secondaryBtnCls}>
            Leave organisation
          </button>
          {canDelete && (
            <button type="button" disabled={locked} onClick={() => setMode('delete')} className={secondaryBtnCls}>
              Delete organisation
            </button>
          )}
        </div>
      )}
      {mode === 'leave' && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-on-surface">You will lose access to {organization.name} and its records. An admin would have to invite you again.</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || !user}
              onClick={() => void finish(() => user!.leaveOrganization(organization.id), 'You could not leave this organisation. Check your connection and try again.')}
              className={dangerBtnCls}
            >
              {busy ? 'Leaving…' : 'Leave organisation'}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode('idle')} className={secondaryBtnCls}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {mode === 'delete' && (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed === organization.name) void finish(() => organization.destroy(), 'The organisation could not be deleted. Check your connection and try again.');
          }}
        >
          <p className="text-on-surface">
            This cannot be undone. Everyone loses access, and nobody will be able to open the records saved in this organisation from the app. They stay stored but out of reach.
          </p>
          <div className="max-w-lg">
            <label htmlFor="org-delete-name" className={labelCls}>
              Type {organization.name} to confirm
            </label>
            <input id="org-delete-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className={fieldCls} />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy || typed !== organization.name} className={dangerBtnCls}>
              {busy ? 'Deleting…' : 'Delete organisation'}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode('idle')} className={secondaryBtnCls}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function InvitationsForYou() {
  const { pending } = useDevice();
  const { userInvitations, refreshLists, switchTo } = useWorkspaces();
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const invitations = userInvitations.data ?? [];
  if (!invitations.length) return null;

  return (
    <section aria-labelledby="org-for-you-h" className={cardCls}>
      <h2 id="org-for-you-h" className={headingCls}>
        Invitations for you
      </h2>
      {error && (
        <p role="alert" className={`${errorCls} mt-3`}>
          {error}
        </p>
      )}
      <ul className="mt-2">
        {invitations.map((inv) => (
          <li key={inv.id} className="flex flex-wrap items-center gap-3 border-b border-outline-variant/60 py-3 last:border-b-0">
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate font-semibold text-on-surface">{inv.publicOrganizationData.name}</p>
              <p className="text-[13px] text-on-surface-variant">{orgRoleLabel(inv.role)}</p>
            </div>
            <button
              type="button"
              disabled={busyId !== ''}
              onClick={async () => {
                setBusyId(inv.id);
                setError('');
                try {
                  await inv.accept();
                  await refreshLists();
                  // With records still queued, joining is safe but the switch waits until they upload.
                  if (pending === 0) await switchTo(inv.publicOrganizationData.id);
                } catch (err) {
                  setError(organisationErrorMessage(err, 'The invitation could not be accepted. Check your connection and try again.'));
                } finally {
                  setBusyId('');
                }
              }}
              className={primaryBtnCls}
            >
              {busyId === inv.id ? 'Joining…' : 'Join'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function OrganisationManager() {
  const { isLoaded, organization, membership } = useOrganization();
  const { userId, orgId, orgRole } = useAuth();
  const { user } = useUser();

  if (!isLoaded) return <p className="text-on-surface-variant">Loading…</p>;

  if (!organization) {
    return (
      <>
        <InvitationsForYou />
        <section aria-labelledby="org-none-h" className={cardCls}>
          <h2 id="org-none-h" className={headingCls}>
            You are in your personal workspace
          </h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Create an organisation to work with a team, or choose one from the workspace menu at the top of the page.
          </p>
          {user?.createOrganizationEnabled && (
            <Link href="/organisation/new" className={`${primaryBtnCls} mt-4`}>
              Create organisation
            </Link>
          )}
        </section>
      </>
    );
  }

  const canManage = userId ? canManageTeam(workspaceAccess(userId, orgId, orgRole)) : false;
  const permissions = membership?.permissions ?? [];
  const canList = canManage || permissions.includes('org:sys_memberships:read');

  return (
    <React.Fragment key={organization.id}>
      <InvitationsForYou />
      <DetailsSection organization={organization} canManage={canManage} roleLabel={orgRoleLabel(orgRole)} />
      <TeamSections organization={organization} canManage={canManage} canList={canList} />
      <LeaveOrDeleteSection organization={organization} canDelete={canManage && organization.adminDeleteEnabled} />
    </React.Fragment>
  );
}
