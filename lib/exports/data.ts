/**
 * Loads everything an export needs (spec §5 Phase 5.1). Server only.
 * - Single record or a filter (date range, site, worker, template); Final records only.
 * - Aggregates are computed in SQL from confirmed metric fields (metric_value), never by a model.
 * - Content is translated field by field with placeholder protection; translations are stored
 *   (encrypted) per version and language and reused.
 */
import { and, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { canSeeWholeOrg, type AuthContext } from '@/lib/auth';
import { workspaceName } from '@/lib/organisations';
import { decryptJson, encryptJson } from '@/lib/crypto';
import { newId } from '@/lib/ids';
import { labelsFor, formatDate } from '@/lib/i18n/labels';
import { languageName } from '@/lib/records/languages';
import { NOTES_SECTION_KEY } from '@/lib/records/refined-record';
import { encounterScope, getRecordDetail, type RecordDetail } from '@/lib/records/service';
import { labelFor } from '@/lib/templates/definition';
import { translateItems, qualityTier } from '@/lib/translate';
import { recordUsage } from '@/lib/billing/usage';
import { llmCostMicros } from '@/lib/billing/rates';
import { toExportRecord, type ExportDoc, type MetricSeries, type TranslatedText } from './model';

export const exportScope = z.union([
  z.object({ encounterIds: z.array(z.string().max(64)).min(1).max(200) }),
  z.object({
    filter: z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      site: z.string().max(120).optional(),
      worker: z.string().max(100).optional(),
      templateId: z.string().max(100).optional(),
    }),
  }),
]);
export type ExportScope = z.infer<typeof exportScope>;

export const MAX_EXPORT_RECORDS = 200;

function filterWhere(ctx: AuthContext, f: Extract<ExportScope, { filter: unknown }>['filter']): SQL {
  const e = schema.encounter;
  const conds: (SQL | undefined)[] = [encounterScope(ctx), eq(e.status, 'final')];
  if (f.from) conds.push(gte(e.encounterDate, f.from));
  if (f.to) conds.push(lte(e.encounterDate, f.to));
  if (f.site) conds.push(eq(e.site, f.site));
  if (f.worker && canSeeWholeOrg(ctx)) conds.push(eq(e.workerId, f.worker));
  if (f.templateId) conds.push(eq(e.templateId, f.templateId));
  return and(...conds)!;
}

export async function resolveIds(ctx: AuthContext, scope: ExportScope): Promise<string[]> {
  const db = getDb();
  const e = schema.encounter;
  if ('encounterIds' in scope) {
    const rows = await db.select({ id: e.id }).from(e).where(and(encounterScope(ctx), eq(e.status, 'final'), inArray(e.id, scope.encounterIds)));
    return scope.encounterIds.filter((id) => rows.some((r) => r.id === id));
  }
  const rows = await db
    .select({ id: e.id })
    .from(e)
    .where(filterWhere(ctx, scope.filter))
    .orderBy(e.encounterDate, e.createdAt)
    .limit(MAX_EXPORT_RECORDS);
  return rows.map((r) => r.id);
}

/** SQL aggregates over confirmed metric values for the records in scope. */
export async function metricSeries(ctx: AuthContext, ids: string[], records: RecordDetail[], lang: string): Promise<MetricSeries[]> {
  if (!ids.length) return [];
  const db = getDb();
  const m = schema.metricValue;
  const scopeWhere = and(eq(m.orgId, ctx.orgId), inArray(m.encounterId, ids));
  const numeric = await db
    .select({ fieldKey: m.fieldKey, label: m.site, value: sql<number>`avg(${m.numValue})`, n: sql<number>`count(*)` })
    .from(m)
    .where(and(scopeWhere, sql`${m.numValue} is not null`))
    .groupBy(m.fieldKey, m.site)
    .orderBy(m.fieldKey, m.site);
  const categorical = await db
    .select({ fieldKey: m.fieldKey, label: m.textValue, value: sql<number>`count(*)` })
    .from(m)
    .where(and(scopeWhere, sql`${m.textValue} is not null`))
    .groupBy(m.fieldKey, m.textValue)
    .orderBy(m.fieldKey, m.textValue);

  const L = labelsFor(lang);
  const fieldInfo = new Map<string, { label: string; unit?: string }>();
  for (const r of records)
    for (const s of r.template.definition.sections) for (const f of s.fields) if (f.metric && !fieldInfo.has(f.key)) fieldInfo.set(f.key, { label: labelFor(f.label, lang), unit: f.unit });

  const out: MetricSeries[] = [];
  for (const [key, info] of fieldInfo) {
    const num = numeric.filter((x) => x.fieldKey === key);
    const cat = categorical.filter((x) => x.fieldKey === key);
    if (num.length) {
      out.push({
        fieldKey: key,
        label: `${info.label} — ${L.t('average')} ${L.t('bySite')}`,
        kind: 'numeric',
        unit: info.unit,
        points: num.map((x) => ({ label: x.label, value: Math.round(Number(x.value) * 10) / 10 })),
      });
    } else if (cat.length) {
      out.push({
        fieldKey: key,
        label: `${info.label} — ${L.t('count')} ${L.t('byValue')}`,
        kind: 'categorical',
        points: cat.map((x) => ({ label: x.label === 'true' ? L.t('yes') : x.label === 'false' ? L.t('no') : x.label!, value: Number(x.value) })),
      });
    }
  }
  return out;
}

/** Translates a record's content into `lang`, reusing a stored translation for the same version. */
async function translatedContent(ctx: AuthContext, r: RecordDetail, lang: string): Promise<{ text: TranslatedText; note: string } | null> {
  const from = r.interviewLanguage;
  if (lang === from || !r.currentVersion) return null;
  const db = getDb();
  const L = labelsFor(lang);
  const [existing] = await db
    .select()
    .from(schema.translation)
    .where(and(eq(schema.translation.versionId, r.currentVersion.id), eq(schema.translation.targetLanguage, lang)))
    .limit(1);
  const note = (createdAt: Date, reviewedBy: string | null) =>
    reviewedBy
      ? L.t('translatedReviewed', { from: languageName(from), date: formatDate(createdAt, lang), name: reviewedBy })
      : L.t('translatedNotReviewed', { from: languageName(from), date: formatDate(createdAt, lang) });
  if (existing) return { text: decryptJson<TranslatedText>(existing.content), note: note(existing.createdAt, existing.reviewedBy) };

  const items: { id: string; text: string }[] = [];
  const content = r.currentVersion.content;
  for (const s of content.sections) s.lines.forEach((l, i) => items.push({ id: `line:${s.key}:${i}`, text: l.text }));
  const textFields = new Set(r.template.definition.sections.flatMap((s) => s.fields).filter((f) => f.type === 'text' || f.type === 'choice').map((f) => f.key));
  for (const f of content.fields) if (textFields.has(f.key) && f.status === 'recorded' && typeof f.value === 'string') items.push({ id: `field:${f.key}`, text: f.value });
  if (!items.length) return null;

  const res = await translateItems(items, from, lang, { respondentRef: r.respondentRef });
  const text: TranslatedText = Object.fromEntries(res.items.map((i) => [i.id, i.text]));
  const now = new Date();
  await db.insert(schema.translation).values({
    id: newId(),
    versionId: r.currentVersion.id,
    targetLanguage: lang,
    engine: res.engine,
    content: encryptJson(text),
    qualityTier: qualityTier(lang),
  });
  await recordUsage({
    orgId: ctx.orgId,
    userId: ctx.userId,
    kind: 'translation_chars',
    quantity: res.chars,
    costUsdMicros: res.usage ? llmCostMicros(res.usage.model, res.usage.inputTokens, res.usage.outputTokens) : 0,
    encounterId: r.id,
  });
  return { text, note: note(now, null) };
}

export async function buildExportDoc(
  ctx: AuthContext,
  scope: ExportScope,
  opts: { lang: string; watermark: boolean; includeOriginals?: boolean },
): Promise<ExportDoc> {
  const ids = await resolveIds(ctx, scope);
  const details: RecordDetail[] = [];
  for (const id of ids) details.push(await getRecordDetail(ctx, id));
  const records = [];
  for (const d of details) {
    const tr = await translatedContent(ctx, d, opts.lang);
    records.push({ ...toExportRecord(d, opts.lang, tr?.text, { includeOriginals: opts.includeOriginals }), translationNote: tr?.note ?? null });
  }
  const aggregate = !('encounterIds' in scope && scope.encounterIds.length === 1);
  const dates = details.map((d) => d.encounterDate).sort();
  const followUps = details.flatMap((d) => {
    const today = new Date().toISOString().slice(0, 10);
    const dateFields = d.template.definition.sections.flatMap((s) => s.fields).filter((f) => f.type === 'date');
    return (d.currentVersion?.content.fields ?? [])
      .filter((f) => dateFields.some((x) => x.key === f.key) && typeof f.value === 'string' && f.value >= today)
      .map((f) => ({ recordId: d.id, site: d.site, label: labelFor(dateFields.find((x) => x.key === f.key)!.label, opts.lang), date: f.value as string }));
  });
  return {
    lang: opts.lang,
    labels: labelsFor(opts.lang),
    orgName: await workspaceName(ctx.orgId),
    exportedAt: new Date(),
    watermark: opts.watermark,
    aggregate,
    records,
    metrics: aggregate ? await metricSeries(ctx, ids, details, opts.lang) : undefined,
    summary: {
      records: details.length,
      sites: [...new Set(details.map((d) => d.site))],
      workers: new Set(details.map((d) => d.workerId)).size,
      from: dates[0] ?? null,
      to: dates.at(-1) ?? null,
    },
    followUps: followUps.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export { NOTES_SECTION_KEY };
