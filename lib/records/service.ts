/**
 * Encounter / record service. Server only.
 *
 * Every function takes an AuthContext and scopes every query to ctx.orgId, and to
 * ctx.userId for workers. Records outside that scope behave exactly like records that
 * don't exist (NotFoundError → 404), so IDs can't be probed.
 */
import { and, count, desc, eq, gte, ilike, lte, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import type { EncounterStatus } from '@/db/schema';
import { canSeeWholeOrg, type AuthContext } from '@/lib/auth';
import { decryptJson, decryptOptional, decryptString, encryptJson, encryptOptional, encryptString } from '@/lib/crypto';
import { newId, newRecordId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { templateDefinition, type TemplateDefinition } from '@/lib/templates/definition';
import { refinedRecord, recordFromTypedText, type RefinedRecord } from './refined-record';
import { INTERVIEW_LANGUAGE_CODES } from './languages';
import { canEdit, signOffBlocker } from '@/lib/encounter-status';

const { encounter, source, refinedVersion, signoff, template, organisation, membership, auditLog } = schema;

export class NotFoundError extends Error {
  status = 404 as const;
  constructor() {
    super('Not found');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  status = 409 as const;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends Error {
  status = 403 as const;
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export const SIGNOFF_STATEMENT =
  'I have reviewed this record against my original notes and confirm it is accurate and complete.';

/** Base WHERE clause for any encounter read or write. */
export function encounterScope(ctx: AuthContext): SQL {
  const conds = [eq(encounter.orgId, ctx.orgId)];
  if (!canSeeWholeOrg(ctx)) conds.push(eq(encounter.workerId, ctx.userId));
  return and(...conds)!;
}

async function audit(ctx: AuthContext, action: string, entityType: string, entityId: string, meta?: Record<string, string | number | boolean | null>) {
  try {
    await getDb().insert(auditLog).values({ id: newId(), orgId: ctx.orgId, actorId: ctx.userId, action, entityType, entityId, meta });
  } catch (err) {
    logger.error('audit.write_failed', { action, entityId, err });
  }
}

/** Creates the organisation and membership rows the first time a user writes. */
async function ensureWorkspace(ctx: AuthContext) {
  const db = getDb();
  await db.batch([
    db
      .insert(organisation)
      .values({ id: ctx.orgId, name: ctx.orgName ?? 'Personal workspace' })
      .onConflictDoNothing(),
    db
      .insert(membership)
      .values({ id: newId(), orgId: ctx.orgId, clerkUserId: ctx.userId, role: ctx.role })
      .onConflictDoUpdate({ target: [membership.orgId, membership.clerkUserId], set: { role: ctx.role } }),
  ]);
}

// ── Templates ────────────────────────────────────────────────────────────────

export type TemplateSummary = { id: string; name: string; version: number; definition: TemplateDefinition };

export async function listTemplates(ctx: AuthContext): Promise<TemplateSummary[]> {
  const rows = await getDb()
    .select({ id: template.id, name: template.name, version: template.version, definition: template.definition })
    .from(template)
    .where(and(eq(template.isActive, true), sql`(${template.orgId} is null or ${template.orgId} = ${ctx.orgId})`))
    .orderBy(template.name);
  return rows;
}

async function getTemplate(ctx: AuthContext, id: string) {
  const [row] = await getDb()
    .select()
    .from(template)
    .where(and(eq(template.id, id), sql`(${template.orgId} is null or ${template.orgId} = ${ctx.orgId})`))
    .limit(1);
  return row ?? null;
}

// ── Create (Process a typed note) ────────────────────────────────────────────

export const createTextEncounterInput = z.object({
  idempotencyKey: z.string().uuid(),
  templateId: z.string().min(1).max(100),
  site: z.string().trim().min(1).max(120),
  encounterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  respondentRef: z.string().trim().max(80).optional().default(''),
  consentObtained: z.literal(true, { error: 'Consent is required before a record can be saved.' }),
  interviewLanguage: z.enum(INTERVIEW_LANGUAGE_CODES),
  text: z.string().max(100_000).refine((t) => t.trim().length > 0, 'The note is empty.'),
  deviceCreatedAt: z.string().datetime().optional(),
});
export type CreateTextEncounterInput = z.input<typeof createTextEncounterInput>;

export async function createTextEncounter(
  ctx: AuthContext,
  workerName: string,
  input: z.output<typeof createTextEncounterInput>,
): Promise<{ id: string; created: boolean }> {
  const db = getDb();

  const existing = await db
    .select({ id: encounter.id })
    .from(encounter)
    .where(and(eq(encounter.orgId, ctx.orgId), eq(encounter.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing[0]) return { id: existing[0].id, created: false };

  const tpl = await getTemplate(ctx, input.templateId);
  if (!tpl) throw new NotFoundError();
  const def = templateDefinition.parse(tpl.definition);

  await ensureWorkspace(ctx);

  const id = newRecordId(input.encounterDate);
  const sourceId = newId();
  const versionId = newId();
  // The original is stored exactly as typed; trimming happens only in the derived version.
  const content = recordFromTypedText(sourceId, input.text, def);

  try {
    await db.batch([
      db.insert(encounter).values({
        id,
        orgId: ctx.orgId,
        workerId: ctx.userId,
        workerName,
        templateId: tpl.id,
        templateVersion: tpl.version,
        site: input.site,
        encounterDate: input.encounterDate,
        respondentRef: encryptOptional(input.respondentRef),
        consentObtained: true,
        interviewLanguage: input.interviewLanguage,
        // Phase 1 has no automated processing, so the typed note goes straight to review.
        status: 'in_review',
        currentVersionId: versionId,
        deviceCreatedAt: input.deviceCreatedAt ? new Date(input.deviceCreatedAt) : null,
        idempotencyKey: input.idempotencyKey,
      }),
      db.insert(source).values({
        id: sourceId,
        encounterId: id,
        kind: 'text',
        mimeType: 'text/plain',
        bytes: Buffer.byteLength(input.text, 'utf8'),
        rawText: encryptString(input.text),
        language: input.interviewLanguage,
        engine: 'typed',
        status: 'ready',
      }),
      db.insert(refinedVersion).values({
        id: versionId,
        encounterId: id,
        versionNo: 1,
        createdBy: ctx.userId,
        content: encryptJson(content),
      }),
    ]);
  } catch (err) {
    // A concurrent retry with the same idempotency key won the race.
    const again = await db
      .select({ id: encounter.id })
      .from(encounter)
      .where(and(eq(encounter.orgId, ctx.orgId), eq(encounter.idempotencyKey, input.idempotencyKey)))
      .limit(1);
    if (again[0]) return { id: again[0].id, created: false };
    throw err;
  }

  await audit(ctx, 'encounter.create', 'encounter', id, { kind: 'text' });
  logger.info('encounter.created', { encounterId: id, orgId: ctx.orgId });
  return { id, created: true };
}

// ── List ─────────────────────────────────────────────────────────────────────

export const listFiltersInput = z.object({
  q: z.string().trim().max(60).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  site: z.string().trim().max(120).optional(),
  status: z.enum(['draft', 'processing', 'in_review', 'final']).optional(),
  worker: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type ListFilters = z.output<typeof listFiltersInput>;

export type EncounterListRow = {
  id: string;
  site: string;
  encounterDate: string;
  status: EncounterStatus;
  workerName: string;
  templateName: string;
  createdAt: Date;
};

export const PAGE_SIZE = 20;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listEncounters(ctx: AuthContext, filters: ListFilters) {
  const db = getDb();
  const conds: (SQL | undefined)[] = [encounterScope(ctx)];
  if (filters.q) conds.push(ilike(encounter.id, `%${escapeLike(filters.q)}%`));
  if (filters.from) conds.push(gte(encounter.encounterDate, filters.from));
  if (filters.to) conds.push(lte(encounter.encounterDate, filters.to));
  if (filters.site) conds.push(eq(encounter.site, filters.site));
  if (filters.status) conds.push(eq(encounter.status, filters.status));
  if (filters.worker && canSeeWholeOrg(ctx)) conds.push(eq(encounter.workerId, filters.worker));
  const where = and(...conds);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: encounter.id,
        site: encounter.site,
        encounterDate: encounter.encounterDate,
        status: encounter.status,
        workerName: encounter.workerName,
        templateName: template.name,
        createdAt: encounter.createdAt,
      })
      .from(encounter)
      .innerJoin(template, eq(template.id, encounter.templateId))
      .where(where)
      .orderBy(desc(encounter.encounterDate), desc(encounter.createdAt))
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(encounter).where(where),
  ]);
  return { rows: rows as EncounterListRow[], total: Number(total), page: filters.page, pageSize: PAGE_SIZE };
}

/** Values for filter dropdowns, limited to what the caller can see. */
export async function listFilterOptions(ctx: AuthContext) {
  const db = getDb();
  const scope = encounterScope(ctx);
  const [sites, workers] = await Promise.all([
    db.selectDistinct({ site: encounter.site }).from(encounter).where(scope).orderBy(encounter.site).limit(200),
    canSeeWholeOrg(ctx)
      ? db
          .selectDistinct({ id: encounter.workerId, name: encounter.workerName })
          .from(encounter)
          .where(scope)
          .orderBy(encounter.workerName)
          .limit(500)
      : Promise.resolve([]),
  ]);
  return { sites: sites.map((s) => s.site), workers };
}

// ── Detail ───────────────────────────────────────────────────────────────────

export type RecordDetail = {
  id: string;
  orgId: string;
  workerId: string;
  workerName: string;
  site: string;
  encounterDate: string;
  respondentRef: string | null;
  consentObtained: boolean;
  interviewLanguage: string;
  status: EncounterStatus;
  createdAt: Date;
  template: { id: string; name: string; version: number; definition: TemplateDefinition };
  sources: { id: string; kind: string; engine: string | null; rawText: string | null; createdAt: Date }[];
  currentVersion: { id: string; versionNo: number; createdBy: string; createdAt: Date; content: RefinedRecord } | null;
  versions: { id: string; versionNo: number; createdBy: string; createdAt: Date }[];
  signoff: { signerId: string; signerName: string; signedAt: Date; statement: string } | null;
};

export async function getRecordDetail(ctx: AuthContext, id: string, opts: { audit?: boolean } = {}): Promise<RecordDetail> {
  const db = getDb();
  const [enc] = await db
    .select()
    .from(encounter)
    .where(and(encounterScope(ctx), eq(encounter.id, id)))
    .limit(1);
  if (!enc) throw new NotFoundError();

  const [tplRows, srcRows, versionRows] = await Promise.all([
    db.select().from(template).where(eq(template.id, enc.templateId)).limit(1),
    db.select().from(source).where(eq(source.encounterId, enc.id)).orderBy(source.createdAt),
    db
      .select({
        id: refinedVersion.id,
        versionNo: refinedVersion.versionNo,
        createdBy: refinedVersion.createdBy,
        createdAt: refinedVersion.createdAt,
        content: refinedVersion.content,
      })
      .from(refinedVersion)
      .where(eq(refinedVersion.encounterId, enc.id))
      .orderBy(desc(refinedVersion.versionNo)),
  ]);
  const tpl = tplRows[0];
  if (!tpl) throw new NotFoundError();

  const current = versionRows.find((v) => v.id === enc.currentVersionId) ?? null;
  let so: RecordDetail['signoff'] = null;
  if (current) {
    const [s] = await db.select().from(signoff).where(eq(signoff.versionId, current.id)).limit(1);
    if (s) so = { signerId: s.signerId, signerName: s.signerName, signedAt: s.signedAt, statement: s.statement };
  }

  if (opts.audit) await audit(ctx, 'encounter.view', 'encounter', enc.id);

  return {
    id: enc.id,
    orgId: enc.orgId,
    workerId: enc.workerId,
    workerName: enc.workerName,
    site: enc.site,
    encounterDate: enc.encounterDate,
    respondentRef: decryptOptional(enc.respondentRef),
    consentObtained: enc.consentObtained,
    interviewLanguage: enc.interviewLanguage,
    status: enc.status,
    createdAt: enc.createdAt,
    template: { id: tpl.id, name: tpl.name, version: tpl.version, definition: templateDefinition.parse(tpl.definition) },
    sources: srcRows.map((s) => ({
      id: s.id,
      kind: s.kind,
      engine: s.engine,
      rawText: s.rawText ? decryptString(s.rawText) : null,
      createdAt: s.createdAt,
    })),
    currentVersion: current
      ? {
          id: current.id,
          versionNo: current.versionNo,
          createdBy: current.createdBy,
          createdAt: current.createdAt,
          content: refinedRecord.parse(decryptJson(current.content)),
        }
      : null,
    versions: versionRows.map((v) => ({ id: v.id, versionNo: v.versionNo, createdBy: v.createdBy, createdAt: v.createdAt })),
    signoff: so,
  };
}

// ── Edit (creates a new version) ─────────────────────────────────────────────

export async function saveEditedVersion(ctx: AuthContext, id: string, content: RefinedRecord, baseVersionId: string) {
  const db = getDb();
  const detail = await getRecordDetail(ctx, id);
  if (detail.workerId !== ctx.userId) throw new ForbiddenError('Only the author can edit this record.');
  if (!canEdit(detail.status, true)) throw new ConflictError('Only records in review can be edited.');
  if (!detail.currentVersion || detail.currentVersion.id !== baseVersionId)
    throw new ConflictError('This record changed since you opened it. Reload and try again.');

  // Field keys must match the template exactly; values for unknown keys are rejected.
  const expected = new Set(detail.currentVersion.content.fields.map((f) => f.key));
  if (content.fields.length !== expected.size || content.fields.some((f) => !expected.has(f.key)))
    throw new ConflictError('Field list does not match the template.');

  const versionId = newId();
  const versionNo = Math.max(...detail.versions.map((v) => v.versionNo)) + 1;
  await db.batch([
    db.insert(refinedVersion).values({
      id: versionId,
      encounterId: id,
      versionNo,
      createdBy: ctx.userId,
      content: encryptJson(content),
      parentVersionId: baseVersionId,
    }),
    db
      .update(encounter)
      .set({ currentVersionId: versionId })
      .where(and(encounterScope(ctx), eq(encounter.id, id), eq(encounter.currentVersionId, baseVersionId))),
  ]);
  await audit(ctx, 'version.create', 'encounter', id, { versionNo });
  return { versionId, versionNo };
}

// ── Sign-off ─────────────────────────────────────────────────────────────────

export async function signOffRecord(
  ctx: AuthContext,
  id: string,
  signerName: string,
  versionId: string,
  attested: boolean,
) {
  const db = getDb();
  const detail = await getRecordDetail(ctx, id);
  const isAuthor = detail.workerId === ctx.userId;
  const blocker = signOffBlocker({ status: detail.status, isAuthor, hasVersion: !!detail.currentVersion, attested });
  if (blocker) throw isAuthor ? new ConflictError(blocker) : new ForbiddenError(blocker);
  if (!detail.currentVersion || detail.currentVersion.id !== versionId)
    throw new ConflictError('This record changed since you opened it. Reload and review it again.');

  await db.batch([
    db.insert(signoff).values({ id: newId(), versionId, signerId: ctx.userId, signerName, statement: SIGNOFF_STATEMENT }),
    db
      .update(encounter)
      .set({ status: 'final' })
      .where(and(encounterScope(ctx), eq(encounter.id, id), eq(encounter.currentVersionId, versionId))),
  ]);
  await audit(ctx, 'encounter.signoff', 'encounter', id, { versionNo: detail.currentVersion.versionNo });
}

// ── Final records (Reports) ──────────────────────────────────────────────────

export async function listFinalRecords(ctx: AuthContext, limit = 200) {
  const db = getDb();
  return db
    .select({
      id: encounter.id,
      site: encounter.site,
      encounterDate: encounter.encounterDate,
      workerName: encounter.workerName,
      templateName: template.name,
      signedAt: signoff.signedAt,
      signerName: signoff.signerName,
    })
    .from(encounter)
    .innerJoin(template, eq(template.id, encounter.templateId))
    .innerJoin(signoff, eq(signoff.versionId, encounter.currentVersionId))
    .where(and(encounterScope(ctx), eq(encounter.status, 'final')))
    .orderBy(desc(encounter.encounterDate), desc(signoff.signedAt))
    .limit(limit);
}

export async function recordExport(ctx: AuthContext, encounterId: string, format: 'pdf' | 'docx' | 'pptx') {
  const id = newId();
  await getDb()
    .insert(schema.exportRecord)
    .values({ id, orgId: ctx.orgId, scope: { encounterIds: [encounterId] }, format, createdBy: ctx.userId });
  await audit(ctx, `export.${format}`, 'encounter', encounterId, { exportId: id });
  return id;
}
