/**
 * Payment lifecycle (spec §7.3). Server only.
 * Activation happens in ONE database transaction keyed on payment.reference, with the payment
 * row locked, so a pass is granted exactly once however many webhooks/polls arrive.
 */
import { and, desc, eq, gt, lte, ne, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { withTransaction } from '@/db/tx';
import { newId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { product, type PurchasableCode } from './plans';
import { applyPurchase } from './rules';
import { toState } from './entitlements';

const { payment, pass, auditLog } = schema;

export type PaymentStatus = 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled';

export async function activatePayment(reference: string, providerTransactionId?: string | null): Promise<'activated' | 'already' | 'not_found'> {
  return withTransaction(async (tx) => {
    const [p] = await tx.select().from(payment).where(eq(payment.reference, reference)).for('update').limit(1);
    if (!p) return 'not_found';
    if (p.status === 'successful') return 'already';

    const code = p.productCode as PurchasableCode;
    const now = new Date();
    const isTeam = code === 'team_seat';
    // Lock the pass this purchase applies to (team pass for the org, else the user's own).
    const [current] = await tx
      .select()
      .from(pass)
      .where(
        isTeam
          ? and(eq(pass.orgId, p.orgId ?? ''), eq(pass.productCode, 'team_seat'), lte(pass.startsAt, now), gt(pass.endsAt, now))
          : and(eq(pass.userId, p.userId), ne(pass.productCode, 'team_seat'), lte(pass.startsAt, now), gt(pass.endsAt, now)),
      )
      .orderBy(desc(pass.endsAt))
      .for('update')
      .limit(1);

    const seats = p.seats ?? 1;
    const result = applyPurchase(current ? toState(current) : null, code, now, seats);
    const sameRow = current && (product(code).kind === 'topup' || current.productCode === code);
    if (sameRow) {
      await tx
        .update(pass)
        .set({
          endsAt: result.pass.endsAt,
          reportsTotal: result.pass.reportsTotal,
          voiceSecondsTotal: result.pass.voiceSecondsTotal,
          ...(isTeam ? { seats: (current.seats ?? 0) + seats } : {}),
        })
        .where(eq(pass.id, current.id));
    } else {
      if (current && result.closePrevious) await tx.update(pass).set({ endsAt: now }).where(eq(pass.id, current.id));
      await tx.insert(pass).values({
        id: newId(),
        userId: p.userId,
        orgId: isTeam ? p.orgId : null,
        sourcePaymentId: p.id,
        seats: isTeam ? Math.max(seats, 5) : null,
        ...result.pass,
      });
    }
    await tx
      .update(payment)
      .set({ status: 'successful', settledAt: now, providerTransactionId: providerTransactionId ?? p.providerTransactionId })
      .where(eq(payment.id, p.id));
    await tx.insert(auditLog).values({
      id: newId(),
      orgId: p.orgId ?? `personal_${p.userId}`,
      actorId: p.userId,
      action: 'payment.activated',
      entityType: 'payment',
      entityId: p.id,
      meta: { productCode: code, amountUgx: p.amountUgx },
    });
    return 'activated';
  });
}

/** Non-success transitions. Never downgrades a successful payment. */
export async function setPaymentStatus(reference: string, status: Exclude<PaymentStatus, 'successful'>) {
  await getDb()
    .update(payment)
    .set({ status })
    .where(and(eq(payment.reference, reference), ne(payment.status, 'successful')));
}

/** Applies a provider status (from webhook, poll or reconciliation). */
export async function applyProviderStatus(reference: string, status: string, providerTransactionId?: string | null) {
  if (status === 'successful') return activatePayment(reference, providerTransactionId);
  if (status === 'failed' || status === 'cancelled') await setPaymentStatus(reference, status);
  else if (status === 'processing' || status === 'on_hold' || status === 'pending') await setPaymentStatus(reference, 'processing');
  return null;
}

export async function getPaymentForUser(reference: string, userId: string) {
  const [p] = await getDb()
    .select()
    .from(payment)
    .where(and(eq(payment.reference, reference), eq(payment.userId, userId)))
    .limit(1);
  return p ?? null;
}

export async function expireStale(olderThanMinutes = 30) {
  const res = await getDb()
    .update(payment)
    .set({ status: 'cancelled' })
    .where(and(sql`${payment.status} in ('pending','processing')`, sql`${payment.createdAt} < now() - (${olderThanMinutes} || ' minutes')::interval`))
    .returning({ reference: payment.reference });
  if (res.length) logger.info('payments.expired', { count: res.length });
  return res.length;
}
