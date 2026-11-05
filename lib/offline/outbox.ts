/**
 * Outbox sync (spec §5 Phase 4.4). Browser only.
 * One item at a time, exponential backoff, idempotent server calls (the draft id is the
 * encounter's idempotency key; parts can be re-sent safely). Triggered on app open, on the
 * `online` event, every 30 s while there is work, by Background Sync where supported, and by
 * the "Sync now" button.
 */
import { attachmentBlob, db, draftStore, segmentBlob, type Draft, type OutboxItem } from './db';
import { DeviceLockedError, isUnlocked } from './crypto';

const PART_BYTES = 3_500_000; // under the 4 MB server limit
const listeners = new Set<() => void>();
let running = false;

export type OutboxView = OutboxItem & { site?: string; date?: string };

export function onOutboxChange(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function emit() {
  for (const l of listeners) l();
}

export async function enqueue(draft: Draft) {
  await draftStore.save({ ...draft, updatedAt: Date.now() });
  await db().outbox.put({ id: draft.id, status: 'queued', attempts: 0, nextAttemptAt: 0, updatedAt: Date.now() });
  emit();
  await registerBackgroundSync();
  void syncNow();
}

export async function pendingItems(): Promise<OutboxView[]> {
  const items = await db().outbox.toArray();
  const out: OutboxView[] = [];
  for (const i of items.filter((x) => x.status !== 'done')) {
    let site: string | undefined;
    let date: string | undefined;
    try {
      const d = await draftStore.get(i.id);
      site = d?.header.site;
      date = d?.header.encounterDate;
    } catch {
      /* locked */
    }
    out.push({ ...i, site, date });
  }
  return out.sort((a, b) => a.updatedAt - b.updatedAt);
}

export async function pendingCount(): Promise<number> {
  return db().outbox.where('status').noneOf(['done']).count();
}

export async function retry(id: string) {
  await db().outbox.update(id, { status: 'queued', attempts: 0, nextAttemptAt: 0, error: undefined });
  emit();
  void syncNow();
}

export async function discard(id: string) {
  await db().outbox.delete(id);
  await draftStore.remove(id);
  emit();
}

class HttpError extends Error {
  constructor(public status: number, message: string, public body: Record<string, unknown> = {}) {
    super(message);
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`, body);
  return body as T;
}

function backoff(attempts: number) {
  return Date.now() + Math.min(10 * 60_000, 5_000 * 2 ** attempts);
}

async function blobFor(draft: Draft, kind: 'audio' | 'upload', ref: string, file: number): Promise<Blob> {
  if (kind === 'audio') {
    const seg = draft.segments[file];
    const b = seg ? await segmentBlob(draft.id, seg.index) : null;
    if (!b) throw new Error('A recording segment is missing on this device.');
    return b;
  }
  const att = draft.attachments.find((a) => a.id === ref);
  const b = att ? await attachmentBlob(att.id, att.mimeType) : null;
  if (!b) throw new Error('An attached file is missing on this device.');
  return b;
}

async function processItem(item: OutboxItem) {
  const draft = await draftStore.get(item.id);
  if (!draft) {
    await db().outbox.delete(item.id);
    return;
  }

  // 1. Create the encounter (idempotent).
  if (!item.encounterId) {
    await db().outbox.update(item.id, { status: 'creating', updatedAt: Date.now() });
    emit();
    const attachments = [
      ...(draft.segments.length
        ? [
            {
              kind: 'audio' as const,
              mimeType: draft.segments[0].mimeType,
              files: draft.segments.length,
              bytes: Math.max(1, draft.segments.reduce((n, s) => n + s.bytes, 0)),
              name: 'Recording',
              clientRef: 'audio',
            },
          ]
        : []),
      ...draft.attachments.map((a) => ({ kind: 'upload' as const, mimeType: a.mimeType, files: 1, bytes: a.bytes, name: a.name, clientRef: a.id })),
    ];
    const res = await api<{ id: string; uploads: { sourceId: string; kind: 'audio' | 'upload'; files: number; clientRef: string | null }[] }>(
      '/api/encounters',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: draft.id,
          ...draft.header,
          text: draft.text,
          attachments,
          deviceCreatedAt: new Date(draft.createdAt).toISOString(),
        }),
      },
    );
    item = {
      ...item,
      encounterId: res.id,
      uploads: res.uploads.map((u) => ({ sourceId: u.sourceId, kind: u.kind, ref: u.clientRef ?? '', files: u.files })),
      status: 'uploading',
      updatedAt: Date.now(),
    };
    await db().outbox.put(item);
    emit();
  }

  // 2. Upload every file in parts, resuming from what the server already has.
  for (const up of item.uploads ?? []) {
    const status = await api<{ status: string; received: Record<string, number[]> }>(`/api/uploads/${up.sourceId}`);
    if (status.status !== 'pending_upload') continue;
    const files: { index: number; parts: number }[] = [];
    for (let f = 0; f < up.files; f++) {
      const blob = await blobFor(draft, up.kind, up.ref, f);
      const parts = Math.max(1, Math.ceil(blob.size / PART_BYTES));
      const have = new Set(status.received[String(f)] ?? []);
      for (let p = 0; p < parts; p++) {
        if (have.has(p)) continue;
        const chunk = blob.slice(p * PART_BYTES, Math.min(blob.size, (p + 1) * PART_BYTES));
        await api(`/api/uploads/${up.sourceId}/${f}/${p}`, { method: 'PUT', body: chunk, headers: { 'Content-Type': 'application/octet-stream' } });
      }
      files.push({ index: f, parts });
    }
    await db().outbox.update(item.id, { status: 'completing', updatedAt: Date.now() });
    emit();
    await api(`/api/uploads/${up.sourceId}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) });
  }

  // 3. Done: the originals are now safely on the server; clear them from the device.
  await draftStore.remove(item.id);
  await db().outbox.update(item.id, { status: 'done', updatedAt: Date.now(), error: undefined });
  const recent = ((await db().meta.get('recentSynced'))?.value as { id: string; encounterId: string; at: number }[] | undefined) ?? [];
  await db().meta.put({ key: 'recentSynced', value: [{ id: item.id, encounterId: item.encounterId!, at: Date.now() }, ...recent].slice(0, 20) });
  await db().outbox.delete(item.id);
  emit();
}

/** Runs the outbox until it is empty or blocked. Single-flight. */
export async function syncNow(): Promise<{ synced: number; failed: number }> {
  if (running || typeof navigator === 'undefined' || !navigator.onLine || !isUnlocked()) return { synced: 0, failed: 0 };
  running = true;
  let synced = 0;
  let failed = 0;
  try {
    for (;;) {
      const now = Date.now();
      const next = (await db().outbox.toArray())
        .filter((i) => i.status !== 'done' && i.status !== 'failed' && i.nextAttemptAt <= now)
        .sort((a, b) => a.updatedAt - b.updatedAt)[0];
      if (!next) break;
      try {
        await processItem(next);
        synced++;
      } catch (err) {
        if (err instanceof DeviceLockedError) break;
        const http = err instanceof HttpError ? err : null;
        const permanent = http && http.status >= 400 && http.status < 500 && ![401, 408, 409, 429].includes(http.status);
        const attempts = next.attempts + 1;
        await db().outbox.update(next.id, {
          status: permanent ? 'failed' : next.status,
          attempts,
          nextAttemptAt: backoff(attempts),
          error: (err as Error).message,
          updatedAt: Date.now(),
        });
        failed++;
        emit();
        if (!permanent && !navigator.onLine) break;
      }
    }
  } finally {
    running = false;
  }
  return { synced, failed };
}

async function registerBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } } | undefined)?.sync;
    await sync?.register('ds-outbox');
  } catch {
    /* not supported */
  }
}

let started = false;
/** Call once on app start. */
export function startOutbox() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void syncNow());
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if ((e.data as { type?: string })?.type === 'ds-sync') void syncNow();
  });
  setInterval(() => void syncNow(), 30_000);
  void syncNow();
}
