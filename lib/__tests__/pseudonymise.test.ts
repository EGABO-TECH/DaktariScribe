import { describe, it, expect } from 'vitest';
import { pseudonymise, restore, restoreDeep } from '@/lib/privacy/pseudonymise';

const TEXT =
  'Mrs Nakato Sarah, phone 0772 123 456 or +256 701-234567, NIN CF12345678ABCD, email sarah.n@example.org. Her husband is John Okello. Ref KIR-004. Temp 38.5, BP 120/80.';

describe('pseudonymise', () => {
  const { text, map } = pseudonymise(TEXT, { respondentRef: 'KIR-004' });

  it('removes identifiers', () => {
    for (const pii of ['Nakato', 'Sarah,', '0772 123 456', '+256 701-234567', 'CF12345678ABCD', 'sarah.n@example.org', 'John Okello', 'KIR-004']) {
      expect(text).not.toContain(pii);
    }
    expect(text).toMatch(/⟦PERSON_1⟧/);
    expect(text).toMatch(/⟦PHONE_1⟧/);
  });

  it('keeps clinical numbers intact', () => {
    expect(text).toContain('38.5');
    expect(text).toContain('120/80');
  });

  it('round-trips exactly', () => {
    expect(restore(text, map)).toBe(TEXT);
    expect(restoreDeep({ a: [text] }, map)).toEqual({ a: [TEXT] });
  });

  it('uses stable placeholders for repeated identifiers', () => {
    const r = pseudonymise('Call 0772123456. Again 0772123456.');
    expect(r.text).toBe('Call ⟦PHONE_1⟧. Again ⟦PHONE_1⟧.');
  });
});
