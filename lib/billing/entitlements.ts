/**
 * Entitlements backed by the database (spec §7.2). Server only.
 *
 * Billing is enforced only when payments are configured (NYLONPAY_API_KEY + NYLONPAY_API_SECRET)
 * or BILLING_ENFORCED=true, so a development install without payment keys stays usable.
 * Without an active pass users can still sign in, read and export every Final record and capture
 * drafts; only new processing is blocked.
 */
import { and, desc, eq, gt, lte, ne, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { withTransaction } from '@/db/tx';
import { keyedHash } from '@/lib/crypto';
import { newId } from '@/lib/ids';
import { recordUsage } from './usage';
import { assertCanProcess, EntitlementError, trialPass, type PassState } from './rules';
import type { Feature, ProductCode } from './plans';

const { pass, trialClaim, usageEvent, membership } = schema;

export function billingEnforced(): boolean {
  return process.env.BILLING_ENFORCED === 'true' || Boolean(process.env.NYLONPAY_API_KEY && process.env.NYLONPAY_API_SECRET);
}

type PassRow = typeof pass.$inferSelect;

export function toState(r: PassRow): PassState {
  return {
    productCode: r.productCode as ProductCode,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    reportsTotal: r.reportsTotal,
    reportsUsed: r.reportsUsed,
    voiceSecondsTotal: r.voiceSecondsTotal,
    voiceSecondsUsed: r.voiceSecondsUsed,
    features: r.features as Feature[],
  };
}

/** The pass that applies to this user now: a team pass of their organisation, else their own. */
export async function getActivePassRow(userId: string, orgId: string | null): Promise<PassRow | null> {
  const db = getDb();
  const now = new Date();
  if (orgId && !orgId.startsWith('personal_')) {
    const [team] = await db
      .select()
      .from(pass)
      .where(and(eq(pass.orgId, orgId), eq(pass.productCode, 'team_seat'), lte(pass.startsAt, now), gt(pass.endsAt, now)))
      .orderBy(desc(pass.endsAt))
      .limit(1);
    if (team) {
      // Seats are enforced: the first N active members (by join date) are covered.
      const covered = await db
        .select({ userId: membership.clerkUserId })
        .from(membership)
        .where(and(eq(membership.orgId, orgId), eq(membership.status, 'active')))
        .orderBy(membership.createdAt)
        .limit(team.seats ?? 0);
      if (covered.some((m) => m.userId === userId)) return team;
    }
  }
  const [own] = await db
    .select()
    .from(pass)
    .where(and(eq(pass.userId, userId), ne(pass.productCode, 'team_seat'), lte(pass.startsAt, now), gt(pass.endsAt, now)))
    .orderBy(desc(pass.endsAt))
    .limit(1);
  return own ?? null;
}

export async function getActivePass(userId: string, orgId: string | null): Promise<PassState | null> {
  const row = await getActivePassRow(userId, orgId);
  return row ? toState(row) : null;
}

/**
 * Counts a report when an encounter is first sent for processing (re-processing is free).
 * Atomic: the UPDATE only succeeds while reports remain.
 */
export async function consumeReport(userId: string, orgId: string, encounterId: string): Promise<void> {
  if (!billingEnforced()) return;
  const db = getDb();
  const [already] = await db
    .select({ id: usageEvent.id })
    .from(usageEvent)
    .where(and(eq(usageEvent.kind, 'encounter'), eq(usageEvent.encounterId, encounterId)))
    .limit(1);
  if (already) return;
  const row = await getActivePassRow(userId, orgId);
  assertCanProcess(row ? toState(row) : null);
  const updated = await db
    .update(pass)
    .set({ reportsUsed: sql`${pass.reportsUsed} + 1` })
    .where(and(eq(pass.id, row!.id), sql`${pass.reportsUsed} < ${pass.reportsTotal}`))
    .returning({ id: pass.id });
  if (!updated.length) throw new EntitlementError('NO_REPORTS', 'You have used all reports on this pass. Add a top-up or buy a new pass.');
  await recordUsage({ orgId, userId, kind: 'encounter', quantity: 1, encounterId });
}

/** Voice seconds are counted from the actual transcribed duration (never blocks a finished job). */
export async function addVoiceSeconds(userId: string, orgId: string, seconds: number): Promise<void> {
  if (!billingEnforced() || seconds <= 0) return;
  const row = await getActivePassRow(userId, orgId);
  if (!row) return;
  await getDb()
    .update(pass)
    .set({ voiceSecondsUsed: sql`${pass.voiceSecondsUsed} + ${Math.round(seconds)}` })
    .where(eq(pass.id, row.id));
}

export async function assertVoiceAvailable(userId: string, orgId: string) {
  if (!billingEnforced()) return;
  assertCanProcess(await getActivePass(userId, orgId), { voiceSeconds: 1 });
}

export async function assertFeature(userId: string, orgId: string, feature: Feature, message: string) {
  if (!billingEnforced()) return;
  const p = await getActivePass(userId, orgId);
  if (!p || !p.features.includes(feature)) throw new EntitlementError('FEATURE', message);
}

/** Trial export mark: true while the user's only active entitlement is the free trial. */
export async function exportWatermark(userId: string, orgId: string): Promise<boolean> {
  if (!billingEnforced()) return false;
  const p = await getActivePass(userId, orgId);
  return !p || p.productCode === 'trial';
}

export class TrialRefusedError extends Error {
  status = 409 as const;
  constructor(message: string) {
    super(message);
    this.name = 'TrialRefusedError';
  }
}

/** One trial per account AND per phone number (spec §7.2). */
export async function claimTrial(userId: string, phoneE164: string, deviceId?: string | null): Promise<PassState> {
  const phoneHash = keyedHash(`phone:${phoneE164}`);
  const deviceHash = deviceId ? keyedHash(`device:${deviceId}`) : null;
  return withTransaction(async (tx) => {
    const [byUser] = await tx.select().from(trialClaim).where(eq(trialClaim.userId, userId)).limit(1);
    if (byUser) throw new TrialRefusedError('This account has already used its free trial.');
    const [byPhone] = await tx.select().from(trialClaim).where(eq(trialClaim.phoneHash, phoneHash)).limit(1);
    if (byPhone) throw new TrialRefusedError('This phone number has already been used for a free trial.');
    if (deviceHash) {
      const [byDevice] = await tx.select().from(trialClaim).where(eq(trialClaim.deviceHash, deviceHash)).limit(1);
      if (byDevice) throw new TrialRefusedError('A free trial has already been used on this device.');
    }
    const t = trialPass();
    await tx.insert(trialClaim).values({ id: newId(), userId, phoneHash, deviceHash });
    await tx.insert(pass).values({ id: newId(), userId, orgId: null, sourcePaymentId: 'trial', ...t });
    return t;
  });
}
