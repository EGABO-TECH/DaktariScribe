import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { decryptJson, decryptString, encryptJson, encryptString, loadKeyring, CryptoConfigError } from '@/lib/crypto';

const k1 = randomBytes(32).toString('base64');
const k2 = randomBytes(32).toString('base64');

describe('lib/crypto', () => {
  const ring = loadKeyring({ DATA_ENCRYPTION_KEY: k1 });

  it('round-trips strings and JSON, including non-Latin text', () => {
    const text = 'Patient reports fever 38.5 °C. Omusujja. ትኩሳት.';
    const enc = encryptString(text, ring);
    expect(enc.startsWith('v1.')).toBe(true);
    expect(enc).not.toContain('fever');
    expect(decryptString(enc, ring)).toBe(text);
    const obj = { a: [1, 2, { b: 'x' }] };
    expect(decryptJson(encryptJson(obj, ring), ring)).toEqual(obj);
  });

  it('uses a fresh IV for every value', () => {
    expect(encryptString('same', ring)).not.toBe(encryptString('same', ring));
  });

  it('detects tampering', () => {
    const enc = encryptString('BP 120/80', ring);
    const [v, body] = enc.split('.');
    const buf = Buffer.from(body, 'base64url');
    buf[buf.length - 1] ^= 0x01;
    expect(() => decryptString(`${v}.${buf.toString('base64url')}`, ring)).toThrow();
  });

  it('fails with the wrong key', () => {
    const enc = encryptString('secret', ring);
    const other = loadKeyring({ DATA_ENCRYPTION_KEY: k2 });
    expect(() => decryptString(enc, other)).toThrow();
  });

  it('supports rotation: new writes use the newest key, old values still decrypt', () => {
    const old = encryptString('old value', ring);
    const rotated = loadKeyring({ DATA_ENCRYPTION_KEY: k1, DATA_ENCRYPTION_KEY_V2: k2 });
    const fresh = encryptString('new value', rotated);
    expect(fresh.startsWith('v2.')).toBe(true);
    expect(decryptString(old, rotated)).toBe('old value');
    expect(decryptString(fresh, rotated)).toBe('new value');
  });

  it('rejects missing or wrong-length keys', () => {
    expect(() => loadKeyring({})).toThrow(CryptoConfigError);
    expect(() => loadKeyring({ DATA_ENCRYPTION_KEY: Buffer.from('short').toString('base64') })).toThrow(CryptoConfigError);
  });
});
