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
import { workspaceName } from '@/lib/organisations';
import { templateDefinition, type TemplateDefinition } from '@/lib/templates/definition';
import { countBlockingFlags, refinedRecord, type RefinedRecord } from './refined-record';
import { INTERVIEW_LANGUAGE_CODES } from './languages';
import { canEdit, signOffBlocker } from '@/lib/encounter-status';

const { encounter, source, refinedVersion, signoff, template, membership, auditLog } = schema;

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
  await workspaceName(ctx.orgId);
  await getDb()
    .insert(membership)
    .values({ id: newId(), orgId: ctx.orgId, clerkUserId: ctx.userId, role: ctx.role })
    .onConflictDoUpdate({ target: [membership.orgId, membership.clerkUserId], set: { role: ctx.role, status: 'active' } });
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

/// ── Create (Process) ─────────────────────────────────────────────────────────

export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac'];
export const UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

const attachmentInput = z.object({
  kind: z.enum(['audio', 'upload']),
  mimeType: z.string().max(120),
  files: z.number().int().min(1).max(48),
  bytes: z.number().int().min(1).max(500 * 1024 * 1024),
  name: z.string().max(200).optional(),
  /** Client-side reference so the device can match upload slots to local files on retry. */
  clientRef: z.string().max(64).optional(),
});

export const createEncounterInput = z
  .object({
    idempotencyKey: z.uuid(),
    templateId: z.string().min(1).max(100),
    site: z.string().trim().min(1).max(120),
    encounterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    respondentRef: z.string().trim().max(80).optional().default(''),
    consentObtained: z.literal(true, { error: 'Consent is required before a record can be saved.' }),
    interviewLanguage: z.enum(INTERVIEW_LANGUAGE_CODES),
    text: z.string().max(100_000).optional().default(''),
    attachments: z.array(attachmentInput).max(20).optional().default([]),
    deviceCreatedAt: z.iso.datetime().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.text.trim() && v.attachments.length === 0) ctx.addIssue({ code: 'custom', message: 'Add a note, a recording or a file first.', path: ['text'] });
    for (const a of v.attachments) {
      const allowed = a.kind === 'audio' ? AUDIO_TYPES.some((t) => a.mimeType.startsWith(t)) : UPLOAD_MIME_TYPES.includes(a.mimeType);
      if (!allowed) ctx.addIssue({ code: 'custom', message: `This file type is not supported: ${a.mimeType}`, path: ['attachments'] });
      if (a.kind === 'upload' && (a.files !== 1 || a.bytes > 20 * 1024 * 1024)) ctx.addIssue({ code: 'custom', message: 'Files must be 20 MB or smaller.', path: ['attachments'] });
    }
  });
export type CreateEncounterInput = z.input<typeof createEncounterInput>;
/** Alias kept for the typed-note path and tests. */
export const createTextEncounterInput = createEncounterInput;

export type CreatedEncounter = {
  id: string;
  created: boolean;
  status: EncounterStatus;
  uploads: { sourceId: string; kind: string; files: number; clientRef: string | null }[];
};

async function existingByKey(ctx: AuthContext, key: string): Promise<CreatedEncounter | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: encounter.id, status: encounter.status })
    .from(encounter)
    .where(and(eq(encounter.orgId, ctx.orgId), eq(encounter.idempotencyKey, key)))
    .limit(1);
  if (!row) return null;
  const srcs = await db
    .select({ id: source.id, kind: source.kind, files: source.fileCount, status: source.status, meta: source.meta })
    .from(source)
    .where(eq(source.encounterId, row.id));
  return {
    id: row.id,
    created: false,
    status: row.status,
    uploads: srcs
      .filter((s) => s.status === 'pending_upload')
      .map((s) => ({ sourceId: s.id, kind: s.kind, files: s.files, clientRef: (s.meta?.clientRef as string | undefined) ?? null })),
  };
}

export async function createEncounter(
  ctx: AuthContext,
  workerName: string,
  input: z.output<typeof createEncounterInput>,
): Promise<CreatedEncounter> {
  const db = getDb();
  const existing = await existingByKey(ctx, input.idempotencyKey);
  if (existing) return existing;

  const tpl = await getTemplate(ctx, input.templateId);
  if (!tpl) throw new NotFoundError();

  // Billing gate (no-op unless payments are configured). Checked before anything is created.
  const { billingEnforced, getActivePass, consumeReport } = await import('@/lib/billing/entitlements');
  if (billingEnforced()) {
    const { assertCanProcess } = await import('@/lib/billing/rules');
    assertCanProcess(await getActivePass(ctx.userId, ctx.orgId), { voiceSeconds: input.attachments.some((a) => a.kind === 'audio') ? 1 : 0 });
  }

  await ensureWorkspace(ctx);

  const id = newRecordId(input.encounterDate);
  const sources: (typeof source.$inferInsert)[] = [];
  if (input.text.trim()) {
    // The original is stored exactly as typed.
    sources.push({
      id: newId(),
      encounterId: id,
      kind: 'text',
      mimeType: 'text/plain',
      bytes: Buffer.byteLength(input.text, 'utf8'),
      rawText: encryptString(input.text),
      language: input.interviewLanguage,
      engine: 'typed',
      status: 'ready',
    });
  }
  for (const a of input.attachments) {
    const sid = newId();
    sources.push({
      id: sid,
      encounterId: id,
      kind: a.kind,
      mimeType: a.mimeType,
      bytes: a.bytes,
      storageKey: `sources/${sid}/`,
      language: input.interviewLanguage,
      status: 'pending_upload',
      fileCount: a.files,
      meta: { fileName: a.name?.slice(0, 200) ?? null, clientRef: a.clientRef ?? null },
    });
  }

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
        status: 'processing',
        deviceCreatedAt: input.deviceCreatedAt ? new Date(input.deviceCreatedAt) : null,
        idempotencyKey: input.idempotencyKey,
      }),
      ...sources.map((s) => db.insert(source).values(s)),
    ]);
  } catch (err) {
    const again = await existingByKey(ctx, input.idempotencyKey);
    if (again) return again;
    throw err;
  }

  await consumeReport(ctx.userId, ctx.orgId, id).catch((err) => logger.error('billing.consume_failed', { encounterId: id, err }));
  await audit(ctx, 'encounter.create', 'encounter', id, { sources: sources.length });
  logger.info('encounter.created', { encounterId: id, orgId: ctx.orgId });

  const uploads = sources
    .filter((s) => s.status === 'pending_upload')
    .map((s) => ({ sourceId: s.id!, kind: s.kind, files: s.fileCount ?? 1, clientRef: (s.meta?.clientRef as string | null) ?? null }));
  if (!uploads.length) {
    const { dispatch } = await import('@/lib/jobs/dispatch');
    await dispatch({ name: 'encounter/refine.requested', data: { encounterId: id, requestedBy: ctx.userId } });
  }
  return { id, created: true, status: 'processing', uploads };
}

/** Typed-note path. */
export async function createTextEncounter(ctx: AuthContext, workerName: string, input: z.output<typeof createEncounterInput>) {
  return createEncounter(ctx, workerName, input);
}

/** Re-process: runs organising again on the same originals. Free (spec §7.2). */
export async function reprocessEncounter(ctx: AuthContext, id: string) {
  const db = getDb();
  const [enc] = await db.select().from(encounter).where(and(encounterScope(ctx), eq(encounter.id, id))).limit(1);
  if (!enc) throw new NotFoundError();
  if (enc.workerId !== ctx.userId) throw new ForbiddenError('Only the author can re-process this record.');
  if (enc.status === 'final') throw new ConflictError('Signed-off records cannot be re-processed.');
  const failed = await db
    .update(source)
    .set({ status: 'pending', error: null })
    .where(and(eq(source.encounterId, id), eq(source.status, 'failed')))
    .returning({ id: source.id, kind: source.kind });
  await db.update(encounter).set({ status: 'processing' }).where(eq(encounter.id, id));
  const { dispatch } = await import('@/lib/jobs/dispatch');
  if (failed.length) {
    for (const f of failed)
      await dispatch({ name: f.kind === 'audio' ? 'source/transcribe.requested' : 'source/extract.requested', data: { sourceId: f.id } });
  } else {
    await dispatch({ name: 'encounter/refine.requested', data: { encounterId: id, requestedBy: ctx.userId } });
  }
  await audit(ctx, 'encounter.reprocess', 'encounter', id);
}

/** A source the caller may upload to (author of an in-scope encounter). */
export async function sourceForUpload(ctx: AuthContext, sourceId: string) {
  const db = getDb();
  const [row] = await db
    .select({ source, workerId: encounter.workerId })
    .from(source)
    .innerJoin(encounter, eq(encounter.id, source.encounterId))
    .where(and(eq(source.id, sourceId), encounterScope(ctx)))
    .limit(1);
  if (!row || row.workerId !== ctx.userId) throw new NotFoundError();
  return row.source;
}

/** A source the caller may read (e.g. audio playback). */
export async function sourceForRead(ctx: AuthContext, sourceId: string) {
  const db = getDb();
  const [row] = await db
    .select({ source })
    .from(source)
    .innerJoin(encounter, eq(encounter.id, source.encounterId))
    .where(and(eq(source.id, sourceId), encounterScope(ctx)))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row.source;
}

export async function markUploaded(ctx: AuthContext, sourceId: string): Promise<boolean> {
  const db = getDb();
  const res = await db
    .update(source)
    .set({ status: 'pending' })
    .where(and(eq(source.id, sourceId), eq(source.status, 'pending_upload')))
    .returning({ id: source.id });
  if (res.length) await audit(ctx, 'source.uploaded', 'source', sourceId);
  return res.length > 0;
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
  sources: {
    id: string;
    kind: string;
    engine: string | null;
    rawText: string | null;
    createdAt: Date;
    status: string;
    error: string | null;
    mimeType: string | null;
    fileCount: number;
    durationSec: number | null;
    /** Audio: [{start,end,text,speaker?,lowConfidence?,file}] · documents: [{page,text}] */
    segments: unknown[] | null;
    meta: Record<string, unknown> | null;
  }[];
  currentVersion: {
    id: string;
    versionNo: number;
    createdBy: string;
    createdAt: Date;
    content: RefinedRecord;
    verification: Record<string, unknown> | null;
  } | null;
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
        verification: refinedVersion.verification,
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
      status: s.status,
      error: s.error,
      mimeType: s.mimeType,
      fileCount: s.fileCount,
      durationSec: s.durationSec,
      segments: s.segments ? decryptJson<unknown[]>(s.segments) : null,
      meta: (s.meta as Record<string, unknown> | null) ?? null,
    })),
    currentVersion: current
      ? {
          id: current.id,
          versionNo: current.versionNo,
          createdBy: current.createdBy,
          createdAt: current.createdAt,
          content: refinedRecord.parse(decryptJson(current.content)),
          verification: (current.verification as Record<string, unknown> | null) ?? null,
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
  const blockingFlags = detail.currentVersion ? countBlockingFlags(detail.currentVersion.content) : 0;
  const blocker = signOffBlocker({ status: detail.status, isAuthor, hasVersion: !!detail.currentVersion, attested, blockingFlags });
  if (blocker) throw isAuthor ? new ConflictError(blocker) : new ForbiddenError(blocker);
  if (!detail.currentVersion || detail.currentVersion.id !== versionId)
    throw new ConflictError('This record changed since you opened it. Reload and review it again.');

  // Confirmed metric values (no identifiers) for Insights and slide charts.
  const metricFields = detail.template.definition.sections.flatMap((s) => s.fields).filter((f) => f.metric);
  const metrics = detail.currentVersion.content.fields
    .filter((f) => f.status === 'recorded' && f.value !== null && metricFields.some((m) => m.key === f.key))
    .map((f) => ({
      id: newId(),
      orgId: detail.orgId,
      encounterId: id,
      workerId: detail.workerId,
      templateId: detail.template.id,
      fieldKey: f.key,
      numValue: typeof f.value === 'number' ? f.value : null,
      textValue: typeof f.value === 'number' ? null : String(f.value),
      site: detail.site,
      encounterDate: detail.encounterDate,
    }));

  await db.batch([
    db.insert(signoff).values({ id: newId(), versionId, signerId: ctx.userId, signerName, statement: SIGNOFF_STATEMENT }),
    db
      .update(encounter)
      .set({ status: 'final' })
      .where(and(encounterScope(ctx), eq(encounter.id, id), eq(encounter.currentVersionId, versionId))),
    ...metrics.map((m) => db.insert(schema.metricValue).values(m).onConflictDoNothing()),
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
