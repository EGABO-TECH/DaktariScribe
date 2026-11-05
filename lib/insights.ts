/**
 * Insights queries (spec §5 Phase 5.3). Server only. Aggregates are computed in SQL from
 * confirmed metric values copied at sign-off (metric_value), never from free text or a model.
 */
import { and, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import type { AuthContext } from '@/lib/auth';
import { labelFor, templateDefinition } from '@/lib/templates/definition';

const m = schema.metricValue;

export const insightsFilter = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  site: z.string().max(120).optional(),
  field: z.string().max(80).optional(),
});
export type InsightsFilter = z.infer<typeof insightsFilter>;

export type MetricOption = { key: string; label: string; unit?: string; kind: 'numeric' | 'categorical'; templateId: string };

export async function metricOptions(ctx: AuthContext): Promise<MetricOption[]> {
  const db = getDb();
  const used = await db
    .selectDistinct({ fieldKey: m.fieldKey, templateId: m.templateId, numeric: sql<boolean>`bool_or(${m.numValue} is not null)` })
    .from(m)
    .where(eq(m.orgId, ctx.orgId))
    .groupBy(m.fieldKey, m.templateId);
  if (!used.length) return [];
  const tpls = await db.select().from(schema.template);
  const out: MetricOption[] = [];
  for (const u of used) {
    if (out.some((o) => o.key === u.fieldKey)) continue;
    const t = tpls.find((x) => x.id === u.templateId);
    const f = t ? templateDefinition.parse(t.definition).sections.flatMap((s) => s.fields).find((x) => x.key === u.fieldKey) : undefined;
    out.push({ key: u.fieldKey, label: f ? labelFor(f.label) : u.fieldKey, unit: f?.unit, kind: u.numeric ? 'numeric' : 'categorical', templateId: u.templateId });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function where(ctx: AuthContext, f: InsightsFilter, fieldKey: string): SQL {
  const conds: (SQL | undefined)[] = [eq(m.orgId, ctx.orgId), eq(m.fieldKey, fieldKey)];
  if (f.from) conds.push(gte(m.encounterDate, f.from));
  if (f.to) conds.push(lte(m.encounterDate, f.to));
  if (f.site) conds.push(eq(m.site, f.site));
  return and(...conds)!;
}

export type InsightsData = {
  metric: MetricOption;
  overTime: { date: string; value: number; n: number }[];
  bySite: { site: string; value: number; n: number }[];
  byValue: { value: string; n: number }[];
  total: number;
};

export async function insightsFor(ctx: AuthContext, f: InsightsFilter, metric: MetricOption): Promise<InsightsData> {
  const db = getDb();
  const w = where(ctx, f, metric.key);
  const numeric = metric.kind === 'numeric';
  const agg = numeric ? sql<number>`round(avg(${m.numValue})::numeric, 1)` : sql<number>`count(*)`;
  const [overTime, bySite, byValue, [{ total }]] = await Promise.all([
    db.select({ date: m.encounterDate, value: agg, n: sql<number>`count(*)` }).from(m).where(w).groupBy(m.encounterDate).orderBy(m.encounterDate).limit(366),
    db.select({ site: m.site, value: agg, n: sql<number>`count(*)` }).from(m).where(w).groupBy(m.site).orderBy(m.site).limit(100),
    numeric
      ? Promise.resolve([])
      : db.select({ value: m.textValue, n: sql<number>`count(*)` }).from(m).where(w).groupBy(m.textValue).orderBy(sql`count(*) desc`).limit(20),
    db.select({ total: sql<number>`count(*)` }).from(m).where(w),
  ]);
  return {
    metric,
    overTime: overTime.map((r) => ({ date: r.date, value: Number(r.value), n: Number(r.n) })),
    bySite: bySite.map((r) => ({ site: r.site, value: Number(r.value), n: Number(r.n) })),
    byValue: (byValue as { value: string | null; n: number }[]).map((r) => ({ value: r.value === 'true' ? 'Yes' : r.value === 'false' ? 'No' : (r.value ?? '—'), n: Number(r.n) })),
    total: Number(total),
  };
}

export async function insightSites(ctx: AuthContext): Promise<string[]> {
  const rows = await getDb().selectDistinct({ site: m.site }).from(m).where(eq(m.orgId, ctx.orgId)).orderBy(m.site).limit(200);
  return rows.map((r) => r.site);
}
