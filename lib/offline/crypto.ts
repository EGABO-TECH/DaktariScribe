/**
 * Device encryption (spec §5 Phase 4.3). Browser only.
 * AES-GCM key derived from the worker's PIN with PBKDF2-SHA256 (310,000 iterations, random salt).
 * The key is non-extractable and lives only in memory; it is dropped on lock (10 min idle),
 * reload, or sign-out. Without the PIN nothing stored on the device can be read.
 */
export const PBKDF2_ITERATIONS = 310_000;
const VERIFIER_TEXT = 'daktariscribe-device-key-v1';

let key: CryptoKey | null = null;
const listeners = new Set<() => void>();

export class DeviceLockedError extends Error {
  constructor() {
    super('This device is locked. Enter your PIN to continue.');
    this.name = 'DeviceLockedError';
  }
}

export function isUnlocked(): boolean {
  return key !== null;
}

export function onLockChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emit() {
  for (const l of listeners) l();
}

export async function deriveKey(pin: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(plain: Uint8Array, k: CryptoKey | null = key): Promise<ArrayBuffer> {
  if (!k) throw new DeviceLockedError();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, plain as BufferSource));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out.buffer;
}

export async function decryptBytes(data: ArrayBuffer, k: CryptoKey | null = key): Promise<Uint8Array> {
  if (!k) throw new DeviceLockedError();
  const buf = new Uint8Array(data);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(0, 12) }, k, buf.subarray(12)));
}

export async function encryptJsonLocal(value: unknown): Promise<ArrayBuffer> {
  return encryptBytes(new TextEncoder().encode(JSON.stringify(value)));
}

export async function decryptJsonLocal<T>(data: ArrayBuffer): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await decryptBytes(data))) as T;
}

/** First-time setup: returns the salt and verifier to store; unlocks the device. */
export async function setupPin(pin: string): Promise<{ salt: Uint8Array; verifier: ArrayBuffer }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const k = await deriveKey(pin, salt);
  const verifier = await encryptBytes(new TextEncoder().encode(VERIFIER_TEXT), k);
  key = k;
  emit();
  return { salt, verifier };
}

/** Unlock with a PIN; returns false if the PIN is wrong. */
export async function unlock(pin: string, salt: Uint8Array, verifier: ArrayBuffer): Promise<boolean> {
  const k = await deriveKey(pin, salt);
  try {
    const plain = await decryptBytes(verifier, k);
    if (new TextDecoder().decode(plain) !== VERIFIER_TEXT) return false;
  } catch {
    return false;
  }
  key = k;
  emit();
  return true;
}

export function lock() {
  key = null;
  emit();
}

/** Test hook. */
export function _setKeyForTests(k: CryptoKey | null) {
  key = k;
}
