/**
 * Cost ledger for admins (spec §7.4): revenue vs processing cost per day and per user, average
 * cost per report (typed vs voice), and an estimated margin per product with an alert below 20%.
 * Uses usage_event / payment only; no patient content.
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import type { AuthContext } from '@/lib/auth';
import { PRODUCTS, PURCHASABLE } from './plans';
import { RATES_USD_MICROS, usdToUgx } from './rates';

const u = schema.usageEvent;
const p = schema.payment;

export async function costReport(ctx: AuthContext, days = 30) {
  const db = getDb();
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const personalOrUser = ctx.orgId.startsWith('personal_');
  const usageScope = and(eq(u.orgId, ctx.orgId), gte(u.createdAt, since));
  const payScope = and(eq(p.status, 'successful'), gte(p.createdAt, since), personalOrUser ? eq(p.userId, ctx.userId) : eq(p.orgId, ctx.orgId));

  const [byDayCost, byDayRevenue, byUserCost, byUserRevenue, perEncounter] = await Promise.all([
    db.select({ day: sql<string>`to_char(${u.createdAt}, 'YYYY-MM-DD')`, micros: sql<number>`sum(${u.costUsdMicros})` }).from(u).where(usageScope).groupBy(sql`1`).orderBy(sql`1`),
    db.select({ day: sql<string>`to_char(${p.createdAt}, 'YYYY-MM-DD')`, ugx: sql<number>`sum(${p.amountUgx})` }).from(p).where(payScope).groupBy(sql`1`).orderBy(sql`1`),
    db.select({ userId: u.userId, micros: sql<number>`sum(${u.costUsdMicros})`, reports: sql<number>`count(*) filter (where ${u.kind} = 'encounter')` }).from(u).where(usageScope).groupBy(u.userId).orderBy(desc(sql`2`)).limit(100),
    db.select({ userId: p.userId, ugx: sql<number>`sum(${p.amountUgx})` }).from(p).where(payScope).groupBy(p.userId),
    db
      .select({
        encounterId: u.encounterId,
        micros: sql<number>`sum(${u.costUsdMicros})`,
        voice: sql<boolean>`bool_or(${u.kind} = 'audio_seconds')`,
      })
      .from(u)
      .where(and(usageScope, sql`${u.encounterId} is not null`))
      .groupBy(u.encounterId),
  ]);

  const typed = perEncounter.filter((e) => !e.voice);
  const voice = perEncounter.filter((e) => e.voice);
  const avg = (rows: typeof perEncounter) => (rows.length ? rows.reduce((n, r) => n + Number(r.micros), 0) / rows.length : 0);
  const avgTypedMicros = avg(typed);
  const avgVoiceMicros = avg(voice);

  const days_ = new Map<string, { day: string; revenueUgx: number; costUgx: number }>();
  for (const r of byDayCost) days_.set(r.day, { day: r.day, revenueUgx: 0, costUgx: usdToUgx(Number(r.micros)) });
  for (const r of byDayRevenue) {
    const d = days_.get(r.day) ?? { day: r.day, revenueUgx: 0, costUgx: 0 };
    d.revenueUgx = Number(r.ugx);
    days_.set(r.day, d);
  }

  // Worst-case cost of a fully used pass at today's average costs.
  const products = PURCHASABLE.filter((c) => PRODUCTS[c].kind === 'pass').map((c) => {
    const prod = PRODUCTS[c] as { name: string; priceUgx: number; reports: number; voiceMin: number };
    const costUgx = usdToUgx(prod.reports * avgTypedMicros + prod.voiceMin * 60 * RATES_USD_MICROS.assemblyaiPerSecond);
    const margin = prod.priceUgx ? (prod.priceUgx - costUgx) / prod.priceUgx : 0;
    return { code: c, name: prod.name, priceUgx: prod.priceUgx, fullUseCostUgx: costUgx, margin, alert: margin < 0.2 };
  });

  return {
    days,
    byDay: [...days_.values()].sort((a, b) => a.day.localeCompare(b.day)),
    byUser: byUserCost.map((r) => ({
      userId: r.userId,
      reports: Number(r.reports),
      costUgx: usdToUgx(Number(r.micros)),
      revenueUgx: Number(byUserRevenue.find((x) => x.userId === r.userId)?.ugx ?? 0),
    })),
    avgCostPerReportUgx: { typed: usdToUgx(avgTypedMicros), voice: usdToUgx(avgVoiceMicros), typedCount: typed.length, voiceCount: voice.length },
    products,
    totals: {
      revenueUgx: byDayRevenue.reduce((n, r) => n + Number(r.ugx), 0),
      costUgx: usdToUgx(byDayCost.reduce((n, r) => n + Number(r.micros), 0)),
    },
  };
}
