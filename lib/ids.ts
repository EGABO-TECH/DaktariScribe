import { customAlphabet, nanoid } from 'nanoid';

// Uppercase, no ambiguous characters (0/O, 1/I/L) so IDs can be read aloud and typed from paper.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const nano8 = customAlphabet(ALPHABET, 8);
const nano4 = customAlphabet(ALPHABET, 4);

/**
 * Record ID in the existing format DS-YYYY-DD-MM-NANO-XXXX, where NANO is an 8-character
 * random segment and XXXX a 4-character one (≈ 31^12 combinations), e.g.
 * DS-2026-05-11-K7QH3MZD-9TRA. The date is the encounter date.
 */
export function newRecordId(encounterDate: Date | string = new Date()): string {
  const d = typeof encounterDate === 'string' ? new Date(`${encounterDate}T00:00:00Z`) : encounterDate;
  const yyyy = d.getUTCFullYear();
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `DS-${yyyy}-${dd}-${mm}-${nano8()}-${nano4()}`;
}

export const RECORD_ID_PATTERN = /^DS-\d{4}-\d{2}-\d{2}-[2-9A-HJKMNP-Z]{8}-[2-9A-HJKMNP-Z]{4}$/;

export function newId(): string {
  return nanoid();
}
