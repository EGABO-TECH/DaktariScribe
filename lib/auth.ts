/**
 * Auth helper (spec §5 Phase 1.2). Every API route and server action calls this and filters
 * every query by `orgId`. Wraps Clerk so the provider can be swapped (e.g. Better Auth) later.
 *
 * Roles come from Clerk Organizations:
 *   org:admin → admin, org:supervisor → supervisor, anything else → worker.
 * A user with no active organisation works in a personal workspace `personal_<userId>`.
 */
import { auth as clerkAuth, currentUser } from '@clerk/nextjs/server';
import type { Role } from '@/db/schema';

export type AuthContext = { userId: string; orgId: string; role: Role; orgName: string | null };

export class UnauthorizedError extends Error {
  status = 401 as const;
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export function mapClerkRole(orgRole: string | null | undefined): Role {
  if (orgRole === 'org:admin') return 'admin';
  if (orgRole === 'org:supervisor') return 'supervisor';
  return 'worker';
}

export function personalOrgId(userId: string): string {
  return `personal_${userId}`;
}

export async function getAuth(): Promise<AuthContext | null> {
  const a = await clerkAuth();
  if (!a.userId) return null;
  const orgId = a.orgId ?? personalOrgId(a.userId);
  const role = a.orgId ? mapClerkRole(a.orgRole) : 'worker';
  const orgName = a.orgId ? ((a.sessionClaims?.org_name as string | undefined) ?? null) : null;
  return { userId: a.userId, orgId, role, orgName };
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuth();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

/** Supervisors and admins see the whole organisation; workers see only their own encounters. */
export function canSeeWholeOrg(ctx: AuthContext): boolean {
  return ctx.role === 'supervisor' || ctx.role === 'admin';
}

/** Display name for author lines. Clerk is only called on writes, never per list row. */
export async function currentUserDisplayName(): Promise<string> {
  const u = await currentUser();
  if (!u) return 'Unknown user';
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.username || u.primaryEmailAddress?.emailAddress || 'Unknown user';
}
