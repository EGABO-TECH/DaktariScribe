/**
 * Auth helper (spec §5 Phase 1.2). Every API route and server action calls this and filters
 * every query by `orgId`. Wraps Clerk so the provider can be swapped (e.g. Better Auth) later.
 * The role rules themselves live in lib/roles.ts.
 */
import { auth as clerkAuth, currentUser } from '@clerk/nextjs/server';
import { workspaceAccess, type WorkspaceAccess } from '@/lib/roles';

export { canSeeWholeOrg, mapClerkRole, personalOrgId } from '@/lib/roles';

export type AuthContext = WorkspaceAccess & { userId: string };

export class UnauthorizedError extends Error {
  status = 401 as const;
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

export async function getAuth(): Promise<AuthContext | null> {
  const a = await clerkAuth();
  if (!a.userId) return null;
  return { userId: a.userId, ...workspaceAccess(a.userId, a.orgId, a.orgRole) };
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuth();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

/** Display name for author lines. Clerk is only called on writes, never per list row. */
export async function currentUserDisplayName(): Promise<string> {
  const u = await currentUser();
  if (!u) return 'Unknown user';
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.username || u.primaryEmailAddress?.emailAddress || 'Unknown user';
}
