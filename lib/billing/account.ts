/** Billing page data. Server only. */
import { desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { AuthContext } from '@/lib/auth';
import { billingEnforced, getActivePass } from './entitlements';
import { nylonPayConfigured } from './nylonpay';
import { product, type ProductCode } from './plans';
import { reportsLeft, voiceSecondsLeft, warnings } from './rules';

export async function billingAccount(ctx: AuthContext) {
  const db = getDb();
  const [pass, payments, [trial], [profile]] = await Promise.all([
    getActivePass(ctx.userId, ctx.orgId),
    db.select().from(schema.payment).where(eq(schema.payment.userId, ctx.userId)).orderBy(desc(schema.payment.createdAt)).limit(50),
    db.select({ id: schema.trialClaim.id }).from(schema.trialClaim).where(eq(schema.trialClaim.userId, ctx.userId)).limit(1),
    db.select({ phoneMasked: schema.billingProfile.phoneMasked }).from(schema.billingProfile).where(eq(schema.billingProfile.userId, ctx.userId)).limit(1),
  ]);
  return {
    enforced: billingEnforced(),
    paymentsReady: nylonPayConfigured(),
    trialUsed: Boolean(trial),
    phoneMasked: profile?.phoneMasked ?? null,
    pass: pass
      ? {
          name: product(pass.productCode).name,
          code: pass.productCode,
          endsAt: pass.endsAt,
          reportsLeft: reportsLeft(pass),
          reportsTotal: pass.reportsTotal,
          voiceMinutesLeft: Math.floor(voiceSecondsLeft(pass) / 60),
          voiceMinutesTotal: Math.floor(pass.voiceSecondsTotal / 60),
          warnings: warnings(pass),
        }
      : null,
    payments: payments.map((p) => ({
      reference: p.reference,
      product: product(p.productCode as ProductCode).name,
      amountUgx: p.amountUgx,
      status: p.status,
      method: p.method,
      createdAt: p.createdAt,
    })),
  };
}
