/**
 * Drug check: every drug name in the output must appear in the original notes, either
 * exactly, as an approved abbreviation (PCM → paracetamol), or as a close spelling
 * (Levenshtein ≤ 2, recorded as a change for the reviewer).
 */
import { ABBREVIATIONS } from '@/lib/clinical/abbreviations';
import { DRUG_NAMES } from '@/lib/clinical/drugs';
import { levenshtein, tokens } from '@/lib/text/sentences';
import { allSourceText, itemsOf, type Change, type CheckResult, type Issue, type VerifyInput } from './types';

function hasPhrase(haystack: string, phrase: string): boolean {
  return new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(haystack);
}

/** Drug names (from the lexicon) mentioned in a text, longest match first. */
export function drugsIn(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const d of [...DRUG_NAMES].sort((a, b) => b.length - a.length)) {
    if (hasPhrase(lower, d) && !found.some((f) => f.includes(d))) found.push(d);
  }
  return found;
}

export function checkDrugs(input: VerifyInput): CheckResult {
  const source = allSourceText(input.sources);
  const lower = source.toLowerCase();
  const srcTokens = new Set(tokens(source));
  const abbrevExpansions = Object.entries(ABBREVIATIONS)
    .filter(([abbr]) => new RegExp(`(^|[^A-Za-z0-9])${abbr.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?=$|[^A-Za-z0-9])`).test(source))
    .map(([, full]) => full.toLowerCase());

  const issues: Issue[] = [];
  const changes: Change[] = [];
  for (const item of itemsOf(input)) {
    const missing: string[] = [];
    for (const drug of drugsIn(item.text)) {
      if (hasPhrase(lower, drug)) continue;
      if (abbrevExpansions.some((e) => e.includes(drug))) continue;
      // Each word of the drug name must have a close spelling in the source.
      const words = drug.split(/[\s-]+/);
      const close = words.every((w) => [...srcTokens].some((t) => t.length >= 4 && levenshtein(t, w) <= 2));
      if (close && words.every((w) => w.length >= 5)) {
        changes.push({ target: item.target, note: `Spelling corrected to “${drug}”.` });
        continue;
      }
      missing.push(drug);
    }
    if (missing.length) {
      issues.push({
        target: item.target,
        check: 'drugs',
        kind: 'not_in_source',
        note: `Medicine not found in the original notes: ${missing.join(', ')}.`,
        blocking: true,
      });
    }
  }
  return { issues, changes };
}
