/**
 * Workspace names. Server only. Clerk's session token carries the organisation id and role but
 * not its name, so the name is stored in the `organisation` table: kept current by the Clerk
 * webhook (lib/clerk-sync.ts) and fetched from Clerk here whenever it isn't known yet.
 */
import { clerkClient } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { logger } from '@/lib/logger';
import { isPersonalOrg } from '@/lib/roles';

const { organisation } = schema;

export const PERSONAL_WORKSPACE_NAME = 'Personal workspace';
/** Used only if Clerk can't be reached; replaced the next time the name is needed. */
const UNRESOLVED_ORG_NAME = 'Organisation';

/** Earlier versions could save this placeholder for a real organisation, so it is treated as unknown too. */
export function isPlaceholderOrgName(name: string): boolean {
  return name === PERSONAL_WORKSPACE_NAME || name === UNRESOLVED_ORG_NAME;
}

/** Returns the display name for the workspace, creating its `organisation` row if needed. */
export async function workspaceName(orgId: string): Promise<string> {
  const db = getDb();
  if (isPersonalOrg(orgId)) {
    await db.insert(organisation).values({ id: orgId, name: PERSONAL_WORKSPACE_NAME }).onConflictDoNothing();
    return PERSONAL_WORKSPACE_NAME;
  }

  const [row] = await db.select({ name: organisation.name }).from(organisation).where(eq(organisation.id, orgId)).limit(1);
  if (row && !isPlaceholderOrgName(row.name)) return row.name;

  let name = UNRESOLVED_ORG_NAME;
  try {
    const clerk = await clerkClient();
    name = (await clerk.organizations.getOrganization({ organizationId: orgId })).name;
  } catch (err) {
    // A Clerk outage must not stop a health worker saving a record.
    logger.error('organisation.name_lookup_failed', { orgId, err });
  }
  await db
    .insert(organisation)
    .values({ id: orgId, name })
    .onConflictDoUpdate({ target: organisation.id, set: { name } });
  return name;
}
