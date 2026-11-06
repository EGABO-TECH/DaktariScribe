/**
 * Keeps the `organisation` and `membership` tables in step with Clerk. Server only.
 * Access decisions never read these tables (they use the session token, lib/auth.ts); they exist
 * for organisation names and for team seat counting (lib/billing/entitlements.ts).
 *
 * Every operation is an upsert or a status change, so repeated deliveries are harmless.
 */
import type { WebhookEvent } from '@clerk/nextjs/webhooks';
import { and, eq, lte } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { Role } from '@/db/schema';
import { newId } from '@/lib/ids';
import { mapClerkRole } from '@/lib/roles';

const { organisation, membership } = schema;

export type ClerkSyncOp =
  | { kind: 'org'; orgId: string; name: string }
  | { kind: 'org-deleted'; orgId: string }
  | { kind: 'member'; orgId: string; orgName: string; userId: string; role: Role; joinedAt: Date; changedAt: Date }
  | { kind: 'member-removed'; orgId: string; userId: string };

/** Turns a verified Clerk event into the change to make, or null if it isn't one we use. */
export function planClerkEvent(evt: WebhookEvent): ClerkSyncOp | null {
  switch (evt.type) {
    case 'organization.created':
    case 'organization.updated':
      return { kind: 'org', orgId: evt.data.id, name: evt.data.name };
    case 'organization.deleted':
      return evt.data.id ? { kind: 'org-deleted', orgId: evt.data.id } : null;
    case 'organizationMembership.created':
    case 'organizationMembership.updated':
      return {
        kind: 'member',
        orgId: evt.data.organization.id,
        orgName: evt.data.organization.name,
        userId: evt.data.public_user_data.user_id,
        role: mapClerkRole(evt.data.role),
        joinedAt: new Date(evt.data.created_at),
        changedAt: new Date(evt.data.updated_at),
      };
    case 'organizationMembership.deleted':
      return { kind: 'member-removed', orgId: evt.data.organization.id, userId: evt.data.public_user_data.user_id };
    default:
      return null;
  }
}

export async function applyClerkSyncOp(op: ClerkSyncOp): Promise<void> {
  const db = getDb();
  switch (op.kind) {
    case 'org':
      await db
        .insert(organisation)
        .values({ id: op.orgId, name: op.name })
        .onConflictDoUpdate({ target: organisation.id, set: { name: op.name } });
      return;
    case 'org-deleted':
      // The organisation row stays: its records must outlive the Clerk organisation.
      await db.update(membership).set({ status: 'inactive' }).where(eq(membership.orgId, op.orgId));
      return;
    case 'member':
      await db.batch([
        db
          .insert(organisation)
          .values({ id: op.orgId, name: op.orgName })
          .onConflictDoUpdate({ target: organisation.id, set: { name: op.orgName } }),
        db
          .insert(membership)
          .values({ id: newId(), orgId: op.orgId, clerkUserId: op.userId, role: op.role, status: 'active', createdAt: op.joinedAt, updatedAt: op.changedAt })
          .onConflictDoUpdate({
            target: [membership.orgId, membership.clerkUserId],
            set: { role: op.role, status: 'active', updatedAt: op.changedAt },
            // A delayed retry of an older event must not undo a newer change, such as a removal.
            where: lte(membership.updatedAt, op.changedAt),
          }),
      ]);
      return;
    case 'member-removed':
      // Kept as inactive rather than deleted, so a later return doesn't change who joined first.
      await db
        .update(membership)
        .set({ status: 'inactive' })
        .where(and(eq(membership.orgId, op.orgId), eq(membership.clerkUserId, op.userId)));
      return;
  }
}
