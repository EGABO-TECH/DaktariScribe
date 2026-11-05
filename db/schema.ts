/**
 * DaktariScribe data model (spec §4).
 *
 * - All IDs are text. Encounters use the `DS-…` record ID; everything else uses nanoid().
 * - Every table has createdAt / updatedAt.
 * - Columns marked 🔒 are encrypted in the app (AES-256-GCM, lib/crypto.ts) BEFORE they are
 *   written. They are stored as `text` holding the ciphertext envelope, because encrypted
 *   JSON cannot live in a jsonb column. Read them back through lib/crypto.ts.
 * - Never log the contents of 🔒 columns.
 */
import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  jsonb,
  timestamp,
  date,
  index,
  uniqueIndex,
  real,
  customType,
} from 'drizzle-orm/pg-core';
import type { TemplateDefinition } from '../lib/templates/definition';

/** bytea that accepts Buffer/Uint8Array or the hex string some drivers return. */
const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array | string }>({
  dataType: () => 'bytea',
  toDriver: (v) => v,
  fromDriver: (v) => {
    if (typeof v === 'string') return Buffer.from(v.startsWith('\\x') ? v.slice(2) : v, 'hex');
    return Buffer.from(v);
  },
});

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export type Role = 'worker' | 'supervisor' | 'admin';
export type EncounterStatus = 'draft' | 'processing' | 'in_review' | 'final';
export type SourceKind = 'text' | 'audio' | 'upload';
export type SourceEngine = 'assemblyai' | 'sunbird' | 'llm-ocr' | 'parser' | 'typed';
export type ExportFormat = 'pdf' | 'docx' | 'pptx';

export const organisation = pgTable('organisation', {
  id: text('id').primaryKey(), // Clerk organisation id, or `personal_<clerkUserId>`
  name: text('name').notNull(),
  logoKey: text('logo_key'),
  plan: text('plan').notNull().default('free'),
  seatLimit: integer('seat_limit'),
  monthlyEncounterQuota: integer('monthly_encounter_quota'),
  defaultLanguage: text('default_language').notNull().default('eng'),
  dataRegion: text('data_region'),
  ...timestamps,
});

export const membership = pgTable(
  'membership',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organisation.id),
    clerkUserId: text('clerk_user_id').notNull(),
    role: text('role').$type<Role>().notNull().default('worker'),
    status: text('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [uniqueIndex('membership_org_user_uq').on(t.orgId, t.clerkUserId)],
);

export const template = pgTable(
  'template',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').references(() => organisation.id), // null = global
    name: text('name').notNull(),
    version: integer('version').notNull().default(1),
    definition: jsonb('definition').$type<TemplateDefinition>().notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (t) => [index('template_org_idx').on(t.orgId)],
);

export const encounter = pgTable(
  'encounter',
  {
    id: text('id').primaryKey(), // DS-YYYY-DD-MM-NANO-XXXX
    orgId: text('org_id')
      .notNull()
      .references(() => organisation.id),
    workerId: text('worker_id').notNull(), // Clerk user id
    workerName: text('worker_name').notNull(), // display name at capture time (author line on exports)
    templateId: text('template_id')
      .notNull()
      .references(() => template.id),
    templateVersion: integer('template_version').notNull(),
    site: text('site').notNull(),
    encounterDate: date('encounter_date').notNull(),
    respondentRef: text('respondent_ref'), // 🔒
    consentObtained: boolean('consent_obtained').notNull(),
    interviewLanguage: text('interview_language').notNull().default('eng'), // ISO 639-3
    status: text('status').$type<EncounterStatus>().notNull().default('draft'),
    currentVersionId: text('current_version_id'),
    deviceCreatedAt: timestamp('device_created_at', { withTimezone: true }),
    /** Client-generated key so a retried submit never creates a second record. */
    idempotencyKey: text('idempotency_key'),
    ...timestamps,
  },
  (t) => [
    index('encounter_org_date_idx').on(t.orgId, t.encounterDate),
    index('encounter_org_worker_idx').on(t.orgId, t.workerId),
    index('encounter_org_status_idx').on(t.orgId, t.status),
    uniqueIndex('encounter_idempotency_uq').on(t.orgId, t.idempotencyKey),
  ],
);

export const source = pgTable(
  'source',
  {
    id: text('id').primaryKey(),
    encounterId: text('encounter_id')
      .notNull()
      .references(() => encounter.id),
    kind: text('kind').$type<SourceKind>().notNull(),
    storageKey: text('storage_key'),
    mimeType: text('mime_type'),
    bytes: bigint('bytes', { mode: 'number' }),
    rawText: text('raw_text'), // 🔒 original, never modified
    language: text('language'),
    engine: text('engine').$type<SourceEngine>(),
    segments: text('segments'), // 🔒 JSON: [{start,end,speaker?,text,confidence?,page?}]
    /** pending_upload | pending | processing | ready | failed */
    status: text('status').notNull().default('ready'),
    error: text('error'),
    /** Number of files (recording segments) stored under storageKey. */
    fileCount: integer('file_count').notNull().default(0),
    durationSec: real('duration_sec'),
    /** Non-identifying processing metadata (engines per segment, removed repeats, page count). */
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index('source_encounter_idx').on(t.encounterId)],
);

export const refinedVersion = pgTable(
  'refined_version',
  {
    id: text('id').primaryKey(),
    encounterId: text('encounter_id')
      .notNull()
      .references(() => encounter.id),
    versionNo: integer('version_no').notNull(),
    createdBy: text('created_by').notNull(), // 'ai' | clerkUserId
    content: text('content').notNull(), // 🔒 JSON RefinedRecord
    verification: jsonb('verification'), // Phase 2 check results (no patient content)
    parentVersionId: text('parent_version_id'),
    ...timestamps,
  },
  (t) => [uniqueIndex('refined_version_no_uq').on(t.encounterId, t.versionNo)],
);

export const signoff = pgTable(
  'signoff',
  {
    id: text('id').primaryKey(),
    versionId: text('version_id')
      .notNull()
      .references(() => refinedVersion.id),
    signerId: text('signer_id').notNull(),
    signerName: text('signer_name').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
    statement: text('statement').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('signoff_version_uq').on(t.versionId)],
);

export const translation = pgTable('translation', {
  id: text('id').primaryKey(),
  versionId: text('version_id')
    .notNull()
    .references(() => refinedVersion.id),
  targetLanguage: text('target_language').notNull(),
  engine: text('engine').notNull(),
  content: text('content').notNull(), // 🔒 JSON
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  qualityTier: text('quality_tier'),
  ...timestamps,
});

export const exportRecord = pgTable(
  'export',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organisation.id),
    scope: jsonb('scope').$type<{ encounterIds?: string[]; filter?: Record<string, unknown> }>().notNull(),
    format: text('format').$type<ExportFormat>().notNull(),
    language: text('language').notNull().default('eng'),
    storageKey: text('storage_key'),
    createdBy: text('created_by').notNull(),
    watermark: boolean('watermark').notNull().default(false),
    ...timestamps,
  },
  (t) => [index('export_org_idx').on(t.orgId)],
);

export const usageEvent = pgTable(
  'usage_event',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    userId: text('user_id').notNull(),
    kind: text('kind')
      .$type<'encounter' | 'audio_seconds' | 'translation_chars' | 'llm_tokens' | 'export'>()
      .notNull(),
    quantity: bigint('quantity', { mode: 'number' }).notNull(),
    costUsdMicros: bigint('cost_usd_micros', { mode: 'number' }).notNull().default(0),
    encounterId: text('encounter_id'),
    ...timestamps,
  },
  (t) => [index('usage_org_created_idx').on(t.orgId, t.createdAt)],
);

export const payment = pgTable(
  'payment',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    orgId: text('org_id'),
    reference: text('reference').notNull(), // UUID sent to Nylon Pay
    productCode: text('product_code').notNull(),
    amountUgx: integer('amount_ugx').notNull(),
    method: text('method').$type<'mobileMoney' | 'card' | 'bank'>().notNull(),
    phoneMasked: text('phone_masked'),
    status: text('status')
      .$type<'pending' | 'processing' | 'successful' | 'failed' | 'cancelled'>()
      .notNull()
      .default('pending'),
    providerTransactionId: text('provider_transaction_id'),
    providerInvoiceId: text('provider_invoice_id'),
    invoiceUrl: text('invoice_url'),
    seats: integer('seats'),
    rawEventIds: jsonb('raw_event_ids').$type<string[]>().notNull().default([]),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('payment_reference_uq').on(t.reference)],
);

export const pass = pgTable(
  'pass',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    orgId: text('org_id'),
    productCode: text('product_code').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    reportsTotal: integer('reports_total').notNull(),
    reportsUsed: integer('reports_used').notNull().default(0),
    voiceSecondsTotal: integer('voice_seconds_total').notNull(),
    voiceSecondsUsed: integer('voice_seconds_used').notNull().default(0),
    features: jsonb('features').$type<string[]>().notNull().default([]),
    /** Team passes only: number of covered members. */
    seats: integer('seats'),
    sourcePaymentId: text('source_payment_id'), // payment id, or 'trial'
    ...timestamps,
  },
  (t) => [index('pass_user_idx').on(t.userId)],
);

export const trialClaim = pgTable(
  'trial_claim',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    phoneHash: text('phone_hash').notNull(),
    deviceHash: text('device_hash'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [uniqueIndex('trial_user_uq').on(t.userId), uniqueIndex('trial_phone_uq').on(t.phoneHash)],
);

export const invoice = pgTable('invoice', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organisation.id),
  amountUgx: integer('amount_ugx').notNull(),
  status: text('status').notNull().default('draft'),
  providerRef: text('provider_ref'),
  pdfKey: text('pdf_key'),
  ...timestamps,
});

export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    actorId: text('actor_id').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    meta: jsonb('meta').$type<Record<string, string | number | boolean | null>>(), // never patient content
    ip: text('ip'),
    ...timestamps,
  },
  (t) => [index('audit_org_created_idx').on(t.orgId, t.createdAt)],
);

/** Encrypted object store used when Cloudflare R2 is not configured (development / small installs). */
export const blob = pgTable('blob', {
  key: text('key').primaryKey(),
  data: bytea('data').notNull(),
  bytes: integer('bytes').notNull(),
  ...timestamps,
});

/**
 * Confirmed metric values copied at sign-off (template fields marked metric: true). No names,
 * notes or respondent references: just the number/choice, the field key, site and date, so
 * Insights and slide charts can aggregate in SQL while record content stays encrypted.
 */
export const metricValue = pgTable(
  'metric_value',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull(),
    encounterId: text('encounter_id')
      .notNull()
      .references(() => encounter.id),
    workerId: text('worker_id').notNull(),
    templateId: text('template_id').notNull(),
    fieldKey: text('field_key').notNull(),
    numValue: real('num_value'),
    textValue: text('text_value'),
    site: text('site').notNull(),
    encounterDate: date('encounter_date').notNull(),
    ...timestamps,
  },
  (t) => [
    index('metric_org_field_date_idx').on(t.orgId, t.fieldKey, t.encounterDate),
    uniqueIndex('metric_encounter_field_uq').on(t.encounterId, t.fieldKey),
  ],
);

/** Processed webhook deliveries (idempotency). */
export const webhookDelivery = pgTable('webhook_delivery', {
  id: text('id').primaryKey(), // provider delivery id
  provider: text('provider').notNull(),
  event: text('event').notNull(),
  reference: text('reference'),
  ...timestamps,
});

/** Token-bucket rate limiting (spec §6.5) without an extra service. */
export const rateLimit = pgTable('rate_limit', {
  key: text('key').primaryKey(),
  tokens: real('tokens').notNull(),
  refilledAt: timestamp('refilled_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user billing profile (phone for mobile money, prefilled at checkout). */
export const billingProfile = pgTable('billing_profile', {
  userId: text('user_id').primaryKey(),
  phoneMasked: text('phone_masked'),
  phone: text('phone'), // 🔒 encrypted
  email: text('email'),
  ...timestamps,
});
