/**
 * Negation check: if the original says "no fever" / "denies vomiting" / "RDT negative", the
 * output must keep that meaning. Dropping the negation, or flipping positive/negative, blocks
 * sign-off.
 */
import { allSourceText, itemsOf, type CheckResult, type Issue, type VerifyInput } from './types';

const CUES = /\b(no|not|denies|denied|deny|without|negative for|nil|absent|none|free of|never)\b/i;
const CUE_THEN_TERMS = /\b(?:no|not|denies|denied|deny|without|negative for|nil|absent|free of|never had)\s+((?:[a-z-]+(?:\s*(?:,|or|and|nor)\s*|\s+)){0,6}[a-z-]+)/gi;
const POLARITY = /\b(positive|negative|reactive|non-reactive|nonreactive|detected|not detected)\b/gi;
const FILLER = new Set(['any', 'other', 'signs', 'sign', 'of', 'history', 'complaints', 'known', 'the', 'a', 'an', 'or', 'and', 'nor', 'has', 'have', 'had', 'is', 'was', 'any']);

/** Terms that the source explicitly negates, e.g. "denies nausea or vomiting" → [nausea, vomiting]. */
export function negatedTerms(source: string): string[] {
  const out = new Set<string>();
  for (const m of source.matchAll(CUE_THEN_TERMS)) {
    for (const w of m[1].toLowerCase().split(/[\s,]+/)) {
      if (w.length >= 4 && !FILLER.has(w)) out.add(w.replace(/s$/, ''));
    }
  }
  return [...out];
}

function mentions(text: string, term: string): number[] {
  const idx: number[] = [];
  const re = new RegExp(`\\b${term}(?:s|es|ing)?\\b`, 'gi');
  for (const m of text.matchAll(re)) idx.push(m.index ?? 0);
  return idx;
}

/** True when a negation cue appears in the same clause before the term (within ~60 chars). */
function negatedAt(text: string, at: number): boolean {
  const before = text.slice(Math.max(0, at - 60), at);
  const clause = before.split(/[.;:!?]/).pop() ?? '';
  return CUES.test(clause) || /\b(negative|absent|nil|none)\b/i.test(text.slice(at, at + 40).split(/[.;!?]/)[0]);
}

function normPolarity(p: string): string {
  const x = p.toLowerCase().replace(/\s+/g, ' ');
  if (x === 'reactive' || x === 'detected') return 'positive';
  if (x === 'non-reactive' || x === 'nonreactive' || x === 'not detected') return 'negative';
  return x;
}

export function checkNegation(input: VerifyInput): CheckResult {
  const source = allSourceText(input.sources);
  const terms = negatedTerms(source);
  const issues: Issue[] = [];
  for (const item of itemsOf(input)) {
    const dropped = terms.filter((t) => {
      const at = mentions(item.text, t);
      return at.length > 0 && at.some((i) => !negatedAt(item.text, i));
    });
    if (dropped.length) {
      issues.push({
        target: item.target,
        check: 'negation',
        kind: 'possible_conflict',
        note: `The original notes say there is no ${dropped.join(' / ')}; this item may have lost that “no”.`,
        blocking: true,
      });
      continue;
    }
    // Polarity: an output "positive"/"negative" must match its spanned source text.
    const outPol = [...item.text.matchAll(POLARITY)].map((m) => normPolarity(m[1]));
    if (outPol.length) {
      const srcPol = new Set([...(item.sourceText || source).matchAll(POLARITY)].map((m) => normPolarity(m[1])));
      if (item.sourceText && outPol.some((p) => !srcPol.has(p))) {
        issues.push({
          target: item.target,
          check: 'negation',
          kind: 'possible_conflict',
          note: 'A positive/negative result here does not match the original notes.',
          blocking: true,
        });
      }
    }
  }
  return { issues };
}
