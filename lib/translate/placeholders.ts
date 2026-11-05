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
  // Replace only in the text between tokens created so far (never inside "⟦…⟧").
  const outside = (re: RegExp, tag: string) => {
    out = out
      .split(/(⟦[^⟧]*⟧)/)
      .map((part, i) => (i % 2 === 1 ? part : part.replace(re, (m) => swap(tag, m))))
      .join('');
  };
  // Pseudonym placeholders (⟦PERSON_1⟧) are wrapped first so the integrity check covers them too.
  out = out.replace(PATTERNS[0].re, (m) => swap('P', m));
  // Drug names first (longest first, case-insensitive, whole words) so "1g" stays a dose token.
  for (const drug of [...DRUG_NAMES].sort((a, b) => b.length - a.length)) {
    outside(new RegExp(`(?<![\\p{L}])${drug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu'), 'DRUG');
  }
  for (const p of PATTERNS.slice(1)) outside(p.re, p.tag);
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
