import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebhookEvent } from '@clerk/nextjs/webhooks';
import { planClerkEvent } from '@/lib/clerk-sync';
import { isPlaceholderOrgName } from '@/lib/organisations';
import { organisationErrorMessage } from '@/lib/organisation-errors';
import { canManageTeam, canSeeWholeOrg, canViewAudit, canViewCosts, canViewInsights, orgRoleLabel, orgToAutoActivate, workspaceAccess } from '@/lib/roles';
import { ADMIN_LINKS, NAV_LINKS, visibleLinks } from '@/components/layout/nav-links';

const { applyClerkSyncOp, dbConfigured, createInvitation, authState } = vi.hoisted(() => ({
  applyClerkSyncOp: vi.fn(),
  dbConfigured: vi.fn(() => true),
  createInvitation: vi.fn(),
  authState: { value: { userId: 'user_1', orgId: 'org_1', orgRole: 'org:admin' } as { userId: string; orgId: string | null; orgRole: string | null } },
}));

vi.mock('@/db', async (original) => ({ ...(await original<typeof import('@/db')>()), isDatabaseConfigured: dbConfigured }));
vi.mock('@/lib/clerk-sync', async (original) => ({ ...(await original<typeof import('@/lib/clerk-sync')>()), applyClerkSyncOp }));
vi.mock('@/lib/ratelimit', () => ({ limit: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => authState.value,
  currentUser: async () => null,
  clerkClient: async () => ({ organizations: { createOrganizationInvitation: createInvitation } }),
}));

const membershipEvent = (type: string, role = 'org:supervisor') =>
  ({
    type,
    object: 'event',
    data: {
      role,
      created_at: 1_000,
      updated_at: 2_000,
      organization: { id: 'org_1', name: 'Kawempe Clinic' },
      public_user_data: { user_id: 'user_1' },
    },
  }) as unknown as WebhookEvent;

describe('workspace access', () => {
  const admin = workspaceAccess('user_1', 'org_1', 'org:admin');
  const supervisor = workspaceAccess('user_1', 'org_1', 'org:supervisor');
  const worker = workspaceAccess('user_1', 'org_1', 'org:member');
  const personal = workspaceAccess('user_1', null, null);

  it('maps the Clerk session to a workspace and role', () => {
    expect(admin).toEqual({ orgId: 'org_1', role: 'admin' });
    expect(supervisor.role).toBe('supervisor');
    expect(worker.role).toBe('worker');
    expect(personal).toEqual({ orgId: 'personal_user_1', role: 'worker' });
  });

  it('never lets a stale role apply without an active organisation', () => {
    expect(workspaceAccess('user_1', null, 'org:admin').role).toBe('worker');
  });

  it('applies the permissions table', () => {
    const row = (a: typeof admin) => [canSeeWholeOrg(a), canViewInsights(a), canViewAudit(a), canViewCosts(a)];
    expect(row(admin)).toEqual([true, true, true, true]);
    expect(row(supervisor)).toEqual([true, true, true, false]);
    expect(row(worker)).toEqual([false, false, false, false]);
    expect(row(personal)).toEqual([false, false, true, true]);
  });

  it('shows menu links that match the page rules', () => {
    const hrefs = (a: typeof admin | null) => visibleLinks([...NAV_LINKS, ...ADMIN_LINKS], a).map((l) => l.href);
    expect(hrefs(worker)).not.toContain('/insights');
    expect(hrefs(worker)).not.toContain('/admin/audit');
    expect(hrefs(supervisor)).toContain('/insights');
    expect(hrefs(supervisor)).not.toContain('/admin/costs');
    expect(hrefs(admin)).toEqual(expect.arrayContaining(['/insights', '/admin/audit', '/admin/costs']));
    expect(hrefs(personal)).toEqual(expect.arrayContaining(['/admin/audit', '/admin/costs']));
    expect(hrefs(null)).toEqual(['/field-entry', '/saved-records', '/reports', '/billing']);
  });
});

describe('team management rules', () => {
  it('only lets an organisation admin manage the team', () => {
    expect(canManageTeam(workspaceAccess('user_1', 'org_1', 'org:admin'))).toBe(true);
    expect(canManageTeam(workspaceAccess('user_1', 'org_1', 'org:supervisor'))).toBe(false);
    expect(canManageTeam(workspaceAccess('user_1', 'org_1', 'org:member'))).toBe(false);
    expect(canManageTeam(workspaceAccess('user_1', null, null))).toBe(false);
  });

  it('names roles the way the app does', () => {
    expect(orgRoleLabel('org:admin')).toBe('Admin');
    expect(orgRoleLabel('org:supervisor')).toBe('Supervisor');
    expect(orgRoleLabel('org:member')).toBe('Health worker');
    expect(orgRoleLabel('org:anything_else')).toBe('Health worker');
  });

  it('shows the organisation link only inside an organisation', () => {
    const hrefs = (a: Parameters<typeof visibleLinks>[1]) => visibleLinks(ADMIN_LINKS, a).map((l) => l.href);
    expect(hrefs(workspaceAccess('user_1', 'org_1', 'org:member'))).toContain('/organisation');
    expect(hrefs(workspaceAccess('user_1', null, null))).not.toContain('/organisation');
  });
});

describe('organisationErrorMessage', () => {
  it('uses our wording for known refusals', () => {
    expect(organisationErrorMessage({ errors: [{ code: 'organization_minimum_permissions_needed', longMessage: 'x' }] }, 'fallback')).toMatch(/at least one admin/);
  });

  it('uses the message from Clerk for other refusals', () => {
    expect(organisationErrorMessage({ errors: [{ code: 'other', longMessage: 'Readable reason.' }] }, 'fallback')).toBe('Readable reason.');
  });

  it('never shows a raw error', () => {
    expect(organisationErrorMessage(new TypeError('Failed to fetch'), 'fallback')).toBe('fallback');
    expect(organisationErrorMessage(null, 'fallback')).toBe('fallback');
  });
});

describe('POST /api/organisation/invitations', () => {
  const post = (payload: unknown) => new Request('http://localhost/api/organisation/invitations', { method: 'POST', body: JSON.stringify(payload) });
  const valid = { emailAddress: 'nurse@example.com', role: 'org:supervisor' };

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com');
    createInvitation.mockReset();
    authState.value = { userId: 'user_1', orgId: 'org_1', orgRole: 'org:admin' };
  });
  afterEach(() => vi.unstubAllEnvs());

  it('invites into the active organisation with a link to our own page', async () => {
    const { POST } = await import('@/app/api/organisation/invitations/route');
    const res = await POST(post({ ...valid, organizationId: 'org_other' }));
    expect(res.status).toBe(201);
    expect(createInvitation).toHaveBeenCalledWith({
      organizationId: 'org_1',
      inviterUserId: 'user_1',
      emailAddress: 'nurse@example.com',
      role: 'org:supervisor',
      redirectUrl: 'https://app.example.com/accept-invitation',
    });
  });

  it.each([
    ['a supervisor', { userId: 'user_1', orgId: 'org_1', orgRole: 'org:supervisor' }],
    ['a health worker', { userId: 'user_1', orgId: 'org_1', orgRole: 'org:member' }],
    ['someone in a personal workspace', { userId: 'user_1', orgId: null, orgRole: null }],
  ])('refuses %s', async (_who, state) => {
    authState.value = state;
    const { POST } = await import('@/app/api/organisation/invitations/route');
    expect((await POST(post(valid))).status).toBe(403);
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('rejects roles the app does not offer', async () => {
    const { POST } = await import('@/app/api/organisation/invitations/route');
    expect((await POST(post({ ...valid, role: 'org:owner' }))).status).toBe(400);
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('passes on a clear reason when Clerk refuses', async () => {
    createInvitation.mockRejectedValueOnce({ status: 422, errors: [{ code: 'organization_membership_quota_exceeded' }] });
    const { POST } = await import('@/app/api/organisation/invitations/route');
    const res = await POST(post(valid));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/member limit/);
  });

  it('does not leak details when Clerk is unreachable', async () => {
    createInvitation.mockRejectedValueOnce(new Error('socket hang up'));
    const { POST } = await import('@/app/api/organisation/invitations/route');
    const res = await POST(post(valid));
    expect(res.status).toBe(500);
    expect((await res.json()).error).not.toMatch(/socket/);
  });
});

describe('orgToAutoActivate', () => {
  it('opens an organisation the device has not seen', () => {
    expect(orgToAutoActivate({ activeOrgId: null, memberOrgIds: ['org_1', 'org_2'], seenOrgIds: ['org_1'] })).toBe('org_2');
  });

  it('respects a later choice of the personal workspace', () => {
    expect(orgToAutoActivate({ activeOrgId: null, memberOrgIds: ['org_1'], seenOrgIds: ['org_1'] })).toBeNull();
  });

  it('never replaces an active organisation', () => {
    expect(orgToAutoActivate({ activeOrgId: 'org_1', memberOrgIds: ['org_1', 'org_2'], seenOrgIds: [] })).toBeNull();
  });
});

describe('isPlaceholderOrgName', () => {
  it('treats only the placeholders as unknown', () => {
    expect(isPlaceholderOrgName('Personal workspace')).toBe(true);
    expect(isPlaceholderOrgName('Organisation')).toBe(true);
    expect(isPlaceholderOrgName('Kawempe Clinic')).toBe(false);
  });
});

describe('planClerkEvent', () => {
  it('maps membership changes, including the role', () => {
    expect(planClerkEvent(membershipEvent('organizationMembership.created'))).toEqual({
      kind: 'member',
      orgId: 'org_1',
      orgName: 'Kawempe Clinic',
      userId: 'user_1',
      role: 'supervisor',
      joinedAt: new Date(1_000),
      changedAt: new Date(2_000),
    });
    expect(planClerkEvent(membershipEvent('organizationMembership.updated', 'org:member'))).toMatchObject({ role: 'worker' });
  });

  it('marks removed members', () => {
    expect(planClerkEvent(membershipEvent('organizationMembership.deleted'))).toEqual({ kind: 'member-removed', orgId: 'org_1', userId: 'user_1' });
  });

  it('maps organisation changes and ignores other events', () => {
    const org = (type: string, data: object) => ({ type, object: 'event', data }) as unknown as WebhookEvent;
    expect(planClerkEvent(org('organization.updated', { id: 'org_1', name: 'New name' }))).toEqual({ kind: 'org', orgId: 'org_1', name: 'New name' });
    expect(planClerkEvent(org('organization.deleted', { id: 'org_1', deleted: true }))).toEqual({ kind: 'org-deleted', orgId: 'org_1' });
    expect(planClerkEvent(org('organization.deleted', { deleted: true }))).toBeNull();
    expect(planClerkEvent(org('user.created', { id: 'user_1' }))).toBeNull();
  });
});

describe('POST /api/webhooks/clerk', () => {
  const secret = Buffer.from('test-signing-secret-of-enough-length').toString('base64');
  const body = JSON.stringify({ ...membershipEvent('organizationMembership.deleted') });

  const signedRequest = (signature?: string) => {
    const id = 'msg_1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = signature ?? `v1,${createHmac('sha256', Buffer.from(secret, 'base64')).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
    return new NextRequest('http://localhost/api/webhooks/clerk', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json', 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': sig },
    });
  };

  beforeEach(() => {
    vi.stubEnv('CLERK_WEBHOOK_SIGNING_SECRET', `whsec_${secret}`);
    applyClerkSyncOp.mockReset();
    dbConfigured.mockReturnValue(true);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('applies a correctly signed event', async () => {
    const { POST } = await import('@/app/api/webhooks/clerk/route');
    const res = await POST(signedRequest());
    expect(res.status).toBe(200);
    expect(applyClerkSyncOp).toHaveBeenCalledWith({ kind: 'member-removed', orgId: 'org_1', userId: 'user_1' });
  });

  it('rejects a bad signature without touching the database', async () => {
    const { POST } = await import('@/app/api/webhooks/clerk/route');
    const res = await POST(signedRequest('v1,AAAA'));
    expect(res.status).toBe(400);
    expect(applyClerkSyncOp).not.toHaveBeenCalled();
  });

  it('asks Clerk to retry when the write fails', async () => {
    applyClerkSyncOp.mockRejectedValueOnce(new Error('db down'));
    const { POST } = await import('@/app/api/webhooks/clerk/route');
    expect((await POST(signedRequest())).status).toBe(500);
  });

  it('asks Clerk to retry when the database is not configured', async () => {
    dbConfigured.mockReturnValue(false);
    const { POST } = await import('@/app/api/webhooks/clerk/route');
    expect((await POST(signedRequest())).status).toBe(503);
    expect(applyClerkSyncOp).not.toHaveBeenCalled();
  });
});
