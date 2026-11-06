/**
 * Role rules shared by server checks and client navigation. Keep this file free of server-only
 * imports so the menus and the pages they link to always apply the same rules.
 *
 * Roles come from Clerk Organizations:
 *   org:admin → admin, org:supervisor → supervisor, anything else → worker.
 * A user with no active organisation works in a personal workspace `personal_<userId>`.
 */
import type { Role } from '@/db/schema';

export type WorkspaceAccess = { orgId: string; role: Role };

export function mapClerkRole(orgRole: string | null | undefined): Role {
  if (orgRole === 'org:admin') return 'admin';
  if (orgRole === 'org:supervisor') return 'supervisor';
  return 'worker';
}

export function personalOrgId(userId: string): string {
  return `personal_${userId}`;
}

export function isPersonalOrg(orgId: string): boolean {
  return orgId.startsWith('personal_');
}

export function workspaceAccess(userId: string, orgId: string | null | undefined, orgRole: string | null | undefined): WorkspaceAccess {
  return orgId ? { orgId, role: mapClerkRole(orgRole) } : { orgId: personalOrgId(userId), role: 'worker' };
}

/** Supervisors and admins see the whole organisation; workers see only their own encounters. */
export function canSeeWholeOrg(a: WorkspaceAccess): boolean {
  return a.role === 'supervisor' || a.role === 'admin';
}

export const canViewInsights = canSeeWholeOrg;

/** People working alone can see the audit log and costs of their own personal workspace. */
export function canViewAudit(a: WorkspaceAccess): boolean {
  return canSeeWholeOrg(a) || isPersonalOrg(a.orgId);
}

export function canViewCosts(a: WorkspaceAccess): boolean {
  return a.role === 'admin' || isPersonalOrg(a.orgId);
}

/**
 * Which organisation to open automatically for someone in their personal workspace. Each
 * organisation opens by itself at most once, so choosing the personal workspace later sticks.
 */
export function orgToAutoActivate(input: { activeOrgId: string | null | undefined; memberOrgIds: string[]; seenOrgIds: string[] }): string | null {
  if (input.activeOrgId) return null;
  return input.memberOrgIds.find((id) => !input.seenOrgIds.includes(id)) ?? null;
}
