/**
 * On-device storage (Dexie / IndexedDB), spec §5 Phase 4.2. Browser only.
 * Every record body is encrypted with the PIN-derived key (lib/offline/crypto); only IDs,
 * timestamps and statuses needed for indexing are stored in clear.
 *
 *   drafts         typed note + encounter details for one encounter being captured
 *   audioChunks    30-second MediaRecorder chunks, grouped by recording segment
 *   attachments    uploaded files (images already compressed), as captured
 *   outbox         drafts the worker has sent for processing, waiting to sync
 *   cachedRecords  recent records for offline viewing and offline PDF
 *   meta           device settings (PIN salt + verifier, session expiry)
 */
import Dexie, { type Table } from 'dexie';
import { decryptBytes, decryptJsonLocal, encryptBytes, encryptJsonLocal } from './crypto';

export type DraftHeader = {
  templateId: string;
  site: string;
  encounterDate: string; // YYYY-MM-DD
  respondentRef: string;
  consentObtained: boolean;
  interviewLanguage: string;
};

export type Draft = {
  /** Also the idempotency key when the draft is processed. */
  id: string;
  header: DraftHeader;
  text: string;
  /** Recording segments captured for this draft (each is a self-contained audio file). */
  segments: { index: number; mimeType: string; durationSec: number; bytes: number; savedAt: number }[];
  attachments: { id: string; name: string; mimeType: string; bytes: number }[];
  createdAt: number;
  updatedAt: number;
};

type Enc = { payload: ArrayBuffer };
type StoredDraft = Enc & { id: string; updatedAt: number };
type StoredChunk = Enc & { id?: number; draftId: string; segment: number; seq: number; mimeType: string };
type StoredAttachment = Enc & { id: string; draftId: string };
export type OutboxItem = {
  id: string; // draft id
  status: 'queued' | 'creating' | 'uploading' | 'completing' | 'done' | 'failed';
  attempts: number;
  nextAttemptAt: number;
  encounterId?: string;
  uploads?: { sourceId: string; kind: 'audio' | 'upload'; ref: string; files: number }[];
  error?: string;
  updatedAt: number;
};
type StoredRecord = Enc & { id: string; updatedAt: number };
type Meta = { key: string; value: unknown };

class OfflineDb extends Dexie {
  drafts!: Table<StoredDraft, string>;
  audioChunks!: Table<StoredChunk, number>;
  attachments!: Table<StoredAttachment, string>;
  outbox!: Table<OutboxItem, string>;
  cachedRecords!: Table<StoredRecord, string>;
  meta!: Table<Meta, string>;
  constructor() {
    super('daktariscribe');
    this.version(1).stores({ drafts: 'id, updatedAt' });
    // v2: encrypted payloads (Phase 4). Unencrypted v1 drafts cannot be read and are cleared.
    this.version(2)
      .stores({
        drafts: 'id, updatedAt',
        audioChunks: '++id, draftId, [draftId+segment+seq]',
        attachments: 'id, draftId',
        outbox: 'id, status, nextAttemptAt',
        cachedRecords: 'id, updatedAt',
        meta: 'key',
      })
      .upgrade((tx) => tx.table('drafts').clear());
  }
}

let _db: OfflineDb | null = null;
export function db(): OfflineDb {
  return (_db ??= new OfflineDb());
}

// ── Meta ─────────────────────────────────────────────────────────────────────
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db().meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await db().meta.put({ key, value });
}

// ── Drafts ───────────────────────────────────────────────────────────────────
export const draftStore = {
  async save(draft: Draft) {
    await db().drafts.put({ id: draft.id, updatedAt: draft.updatedAt, payload: await encryptJsonLocal(draft) });
  },
  async get(id: string): Promise<Draft | undefined> {
    const row = await db().drafts.get(id);
    return row ? normalise(await decryptJsonLocal<Draft>(row.payload)) : undefined;
  },
  async list(): Promise<Draft[]> {
    const rows = await db().drafts.orderBy('updatedAt').reverse().toArray();
    const queued = new Set((await db().outbox.toArray()).map((o) => o.id));
    const out: Draft[] = [];
    for (const r of rows) if (!queued.has(r.id)) out.push(normalise(await decryptJsonLocal<Draft>(r.payload)));
    return out;
  },
  /** Removes the draft and everything captured for it. */
  async remove(id: string) {
    await db().transaction('rw', [db().drafts, db().audioChunks, db().attachments], async () => {
      await db().drafts.delete(id);
      await db().audioChunks.where('draftId').equals(id).delete();
      await db().attachments.where('draftId').equals(id).delete();
    });
  },
};

function normalise(d: Draft): Draft {
  return { ...d, segments: d.segments ?? [], attachments: d.attachments ?? [] };
}

// ── Audio ────────────────────────────────────────────────────────────────────
export async function saveAudioChunk(draftId: string, segment: number, seq: number, blob: Blob) {
  const payload = await encryptBytes(new Uint8Array(await blob.arrayBuffer()));
  await db().audioChunks.add({ draftId, segment, seq, mimeType: blob.type, payload });
}

export async function segmentBlob(draftId: string, segment: number): Promise<Blob | null> {
  const rows = await db().audioChunks.where('[draftId+segment+seq]').between([draftId, segment, 0], [draftId, segment, Infinity]).toArray();
  if (!rows.length) return null;
  const parts: BlobPart[] = [];
  for (const r of rows) parts.push((await decryptBytes(r.payload)) as BlobPart);
  return new Blob(parts, { type: rows[0].mimeType });
}

export async function deleteSegment(draftId: string, segment: number) {
  await db().audioChunks.where('[draftId+segment+seq]').between([draftId, segment, 0], [draftId, segment, Infinity]).delete();
}

// ── Attachments ──────────────────────────────────────────────────────────────
export async function saveAttachment(draftId: string, id: string, file: Blob) {
  await db().attachments.put({ id, draftId, payload: await encryptBytes(new Uint8Array(await file.arrayBuffer())) });
}
export async function attachmentBlob(id: string, mimeType: string): Promise<Blob | null> {
  const row = await db().attachments.get(id);
  return row ? new Blob([(await decryptBytes(row.payload)) as BlobPart], { type: mimeType }) : null;
}
export async function deleteAttachment(id: string) {
  await db().attachments.delete(id);
}

// ── Cached records ───────────────────────────────────────────────────────────
export async function cacheRecord(id: string, record: unknown) {
  await db().cachedRecords.put({ id, updatedAt: Date.now(), payload: await encryptJsonLocal(record) });
  // Keep the newest 200.
  const old = await db().cachedRecords.orderBy('updatedAt').reverse().offset(200).primaryKeys();
  if (old.length) await db().cachedRecords.bulkDelete(old);
}
export async function getCachedRecord<T>(id: string): Promise<T | undefined> {
  const row = await db().cachedRecords.get(id);
  return row ? decryptJsonLocal<T>(row.payload) : undefined;
}

/** Sign-out: wipe everything on this device (spec §5 Phase 4.3). */
export async function wipeDevice() {
  if (_db) _db.close();
  _db = null;
  await Dexie.delete('daktariscribe');
}
