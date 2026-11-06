'use client';

import { useAuth } from '@clerk/nextjs';
import { workspaceAccess, type WorkspaceAccess } from '@/lib/roles';

/** The active workspace and role for menus. Null until Clerk has loaded. Pages check on the server too. */
export function useWorkspaceAccess(): WorkspaceAccess | null {
  const { isLoaded, userId, orgId, orgRole } = useAuth();
  if (!isLoaded || !userId) return null;
  return workspaceAccess(userId, orgId, orgRole);
}
