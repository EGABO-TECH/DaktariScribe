/**
 * App-level field encryption (spec §4, §6.2). Server only.
 *
 * AES-256-GCM, a random 96-bit IV per value, and a key-version prefix so keys can be rotated:
 *   "v1.<base64url(iv | authTag | ciphertext)>"
 * Keys come from DATA_ENCRYPTION_KEY (v1) and, after a rotation, DATA_ENCRYPTION_KEY_V2 etc.
 * New values are always written with the highest configured version.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const IV_BYTES = 12;
const TAG_BYTES = 16;

export class CryptoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoConfigError';
  }
}

type Keyring = { current: string; keys: Map<string, Buffer> };

function parseKey(name: string, value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new CryptoConfigError(`${name} must be 32 bytes, base64-encoded (openssl rand -base64 32).`);
  return key;
}

export function loadKeyring(env: Record<string, string | undefined> = process.env): Keyring {
  const keys = new Map<string, Buffer>();
  if (env.DATA_ENCRYPTION_KEY) keys.set('v1', parseKey('DATA_ENCRYPTION_KEY', env.DATA_ENCRYPTION_KEY));
  for (const [name, value] of Object.entries(env)) {
    const m = name.match(/^DATA_ENCRYPTION_KEY_V(\d+)$/);
    if (m && value) keys.set(`v${m[1]}`, parseKey(name, value));
  }
  if (keys.size === 0) throw new CryptoConfigError('DATA_ENCRYPTION_KEY is not set.');
  const current = [...keys.keys()].sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))[0];
  return { current, keys };
}

let cached: Keyring | null = null;
function keyring(): Keyring {
  return (cached ??= loadKeyring());
}

export function encryptString(plaintext: string, ring: Keyring = keyring()): string {
  const key = ring.keys.get(ring.current)!;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ring.current}.${Buffer.concat([iv, tag, ct]).toString('base64url')}`;
}

export function decryptString(envelope: string, ring: Keyring = keyring()): string {
  const dot = envelope.indexOf('.');
  if (dot < 1) throw new Error('Malformed ciphertext');
  const version = envelope.slice(0, dot);
  const key = ring.keys.get(version);
  if (!key) throw new Error(`No key for version ${version}`);
  const buf = Buffer.from(envelope.slice(dot + 1), 'base64url');
  if (buf.length < IV_BYTES + TAG_BYTES) throw new Error('Malformed ciphertext');
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag); // tampering makes final() throw
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function encryptJson(value: unknown, ring?: Keyring): string {
  return encryptString(JSON.stringify(value), ring);
}

export function decryptJson<T>(envelope: string, ring?: Keyring): T {
  return JSON.parse(decryptString(envelope, ring)) as T;
}

export function encryptOptional(value: string | null | undefined, ring?: Keyring): string | null {
  return value ? encryptString(value, ring) : null;
}

export function decryptOptional(envelope: string | null | undefined, ring?: Keyring): string | null {
  return envelope ? decryptString(envelope, ring) : null;
}

/**
 * Binary encryption for stored files (audio, uploads, exports): "v1" + 0x00 + iv + tag + ciphertext.
 */
export function encryptBuffer(plain: Buffer, ring: Keyring = keyring()): Buffer {
  const key = ring.keys.get(ring.current)!;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from(`${ring.current}\0`, 'utf8'), iv, cipher.getAuthTag(), ct]);
}

export function decryptBuffer(data: Buffer, ring: Keyring = keyring()): Buffer {
  const nul = data.indexOf(0);
  if (nul < 2 || nul > 8) throw new Error('Malformed encrypted file');
  const version = data.subarray(0, nul).toString('utf8');
  const key = ring.keys.get(version);
  if (!key) throw new Error(`No key for version ${version}`);
  const iv = data.subarray(nul + 1, nul + 1 + IV_BYTES);
  const tag = data.subarray(nul + 1 + IV_BYTES, nul + 1 + IV_BYTES + TAG_BYTES);
  const ct = data.subarray(nul + 1 + IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

/** Keyed hash for lookups that must not reveal the value (e.g. trial phone numbers). */
export function keyedHash(value: string, ring: Keyring = keyring()): string {
  const key = ring.keys.get('v1') ?? ring.keys.get(ring.current)!;
  return createHmac('sha256', key).update(value).digest('hex');
}
