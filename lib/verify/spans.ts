/**
 * Span check: every line and recorded field must point at real source text, and must share
 * meaningful words with it. A line with no usable span is "not in source" and blocks sign-off
 * until the worker accepts or edits it.
 */
import { ABBREVIATIONS } from '@/lib/clinical/abbreviations';
import { meaningfulTokens } from '@/lib/text/sentences';
import { itemsOf, type CheckResult, type Issue, type VerifyInput } from './types';

const MIN_OVERLAP = 0.4;

/** Source text plus the expansions of any approved abbreviations it contains. */
export function expandForComparison(source: string): string {
  let extra = '';
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    // Case-insensitive, except one-letter keys ("T") which would match too much.
    const flags = abbr.length > 1 ? 'i' : '';
    const re = new RegExp(`(^|[^A-Za-z0-9])${abbr.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?=$|[^A-Za-z0-9])`, flags);
    if (re.test(source)) extra += ` ${full}`;
  }
  return source + extra;
}

/** Light stemming so "vomits"/"vomiting" and "fevers"/"fever" compare equal. */
function stem(t: string): string {
  return t.replace(/(ing|ed|es|s)$/, '');
}

export function overlap(output: string, source: string): number {
  const out = meaningfulTokens(output).map(stem);
  if (!out.length) return 1;
  const src = new Set(meaningfulTokens(expandForComparison(source)).map(stem));
  return out.filter((t) => src.has(t)).length / out.length;
}

export function checkSpans(input: VerifyInput): CheckResult {
  const issues: Issue[] = [];
  for (const item of itemsOf(input)) {
    const valid = item.spans.filter((s) => {
      const src = input.sources.find((x) => x.id === s.sourceId);
      return src && s.start >= 0 && s.end > s.start && s.end <= src.text.length;
    });
    if (!valid.length) {
      issues.push({
        target: item.target,
        check: 'spans',
        kind: 'not_in_source',
        note: 'This item does not point to anything in the original notes.',
        blocking: true,
      });
      continue;
    }
    if (valid.length !== item.spans.length) {
      issues.push({ target: item.target, check: 'spans', kind: 'not_in_source', note: 'Part of this item points outside the original notes.', blocking: true });
      continue;
    }
    if (item.target.kind === 'line' && overlap(item.text, item.sourceText) < MIN_OVERLAP) {
      issues.push({
        target: item.target,
        check: 'spans',
        kind: 'not_in_source',
        note: 'The wording here is not supported by the part of the original notes it points to.',
        blocking: true,
      });
    }
    if (item.target.kind === 'field') {
      const field = input.fields.find((f) => f.key === (item.target as { key: string }).key);
      if (field && (field.type === 'text' || field.type === 'choice') && overlap(item.text, item.sourceText) < 0.5) {
        issues.push({
          target: item.target,
          check: 'spans',
          kind: 'not_in_source',
          note: 'This value is not found in the part of the original notes it points to.',
          blocking: true,
        });
      }
    }
  }
  return { issues };
}
