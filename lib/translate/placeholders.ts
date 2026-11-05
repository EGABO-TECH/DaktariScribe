/**
 * Placeholder protection for translation (spec §5 Phase 5.2). Before translating, every
 * number + unit, date, dose, drug name, record ID and personal-detail placeholder is replaced
 * with a token like ⟦N1⟧. After translating, tokens are restored; if any token is missing,
 * duplicated or altered, the translation is rejected.
 */
import { DRUG_NAMES } from '@/lib/clinical/drugs';

export type ProtectMap = Map<string, string>;

export class TranslationIntegrityError extends Error {
  constructor(public missing: string[]) {
    super('The translation changed or dropped protected values (numbers, dates, doses or names).');
    this.name = 'TranslationIntegrityError';
  }
}

const UNIT = '(?:\\s?(?:mg|g|mcg|µg|kg|ml|mL|l|L|IU|iu|units?|mmHg|bpm|%|°\\s?C|°|C\\b|cm|mm|weeks?|wks?|days?|months?|years?|yrs?|hours?|hrs?|tabs?|tablets?|g\\/dL|mmol\\/L|\\/min|x\\s?\\d+))?';
const PATTERNS: { tag: string; re: RegExp }[] = [
  { tag: 'P', re: /⟦[A-Z]+_\d+⟧/g }, // pseudonym placeholders pass through untouched
  { tag: 'ID', re: /\bDS-\d{4}-\d{2}-\d{2}-[A-Z0-9]{8}-[A-Z0-9]{4}\b/g },
  { tag: 'D', re: /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/g },
  { tag: 'N', re: new RegExp(`\\d+(?:[.,]\\d+)?(?:\\/\\d+(?:[.,]\\d+)?)*${UNIT}`, 'g') },
];

export function protect(text: string): { text: string; map: ProtectMap } {
  const map: ProtectMap = new Map();
  const counters: Record<string, number> = {};
  let out = text;
  const swap = (tag: string, value: string) => {
    counters[tag] = (counters[tag] ?? 0) + 1;
    const token = `⟦${tag}${counters[tag]}⟧`;
    map.set(token, value);
    return token;
  };
  for (const p of PATTERNS) {
    out = out.replace(p.re, (m) => (p.tag === 'P' ? swap('P', m) : swap(p.tag, m)));
  }
  // Drug names (longest first, case-insensitive, whole words)
  for (const drug of [...DRUG_NAMES].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![\\p{L}⟦])${drug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu');
    out = out.replace(re, (m) => swap('DRUG', m));
  }
  return { text: out, map };
}

/** Restores tokens; throws if any token is missing, duplicated, or unknown tokens appear. */
export function unprotect(translated: string, map: ProtectMap): string {
  const found = translated.match(/⟦[A-Z]+\d+⟧/g) ?? [];
  const missing = [...map.keys()].filter((t) => found.filter((f) => f === t).length !== 1);
  const unknown = found.filter((t) => !map.has(t));
  if (missing.length || unknown.length) throw new TranslationIntegrityError([...missing, ...unknown]);
  return translated.replace(/⟦[A-Z]+\d+⟧/g, (t) => map.get(t)!);
}
