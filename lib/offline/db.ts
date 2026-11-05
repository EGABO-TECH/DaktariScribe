/**
 * On-device storage (Dexie / IndexedDB). Browser only.
 *
 * Phase 1 stores typed drafts. Records are kept as an opaque `payload` string produced by a
 * codec, so Phase 4 can switch the codec to AES-GCM (PIN-derived key) without a schema
 * change. Phase 4 also adds audioChunks, attachments, outbox and cachedRecords tables.
 */
import Dexie, { type Table } from 'dexie';

export type DraftHeader = {
  templateId: string;
  site: string;
  encounterDate: string; // YYYY-MM-DD
  respondentRef: string;
  consentObtained: boolean;
  interviewLanguage: string;
};

export type Draft = {
  /** Also used as the idempotency key when the draft is processed. */
  id: string;
  header: DraftHeader;
  text: string;
  createdAt: number;
  updatedAt: number;
};

type StoredDraft = { id: string; updatedAt: number; payload: string };

export interface Codec {
  encode(value: Draft): Promise<string>;
  decode(payload: string): Promise<Draft>;
}

/** Plain JSON codec. Replaced by an encrypting codec in Phase 4. */
export const jsonCodec: Codec = {
  encode: async (v) => JSON.stringify(v),
  decode: async (p) => JSON.parse(p) as Draft,
};

class OfflineDb extends Dexie {
  drafts!: Table<StoredDraft, string>;
  constructor() {
    super('daktariscribe');
    this.version(1).stores({ drafts: 'id, updatedAt' });
  }
}

let _db: OfflineDb | null = null;
function db(): OfflineDb {
  return (_db ??= new OfflineDb());
}

export function createDraftStore(codec: Codec = jsonCodec) {
  return {
    async save(draft: Draft): Promise<void> {
      await db().drafts.put({ id: draft.id, updatedAt: draft.updatedAt, payload: await codec.encode(draft) });
    },
    async get(id: string): Promise<Draft | undefined> {
      const row = await db().drafts.get(id);
      return row ? codec.decode(row.payload) : undefined;
    },
    async list(): Promise<Draft[]> {
      const rows = await db().drafts.orderBy('updatedAt').reverse().toArray();
      return Promise.all(rows.map((r) => codec.decode(r.payload)));
    },
    async remove(id: string): Promise<void> {
      await db().drafts.delete(id);
    },
    /** Called on sign-out (Phase 4 wipes every table). */
    async clear(): Promise<void> {
      await db().drafts.clear();
    },
  };
}

export type DraftStore = ReturnType<typeof createDraftStore>;
export const draftStore = createDraftStore();
