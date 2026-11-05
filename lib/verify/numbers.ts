/**
 * Number check: every number (with its unit), date part, dose and percentage in the output
 * must appear in the original notes. Handles "38.5" / "38,5" / "thirty-eight point five",
 * "120/80", "80/480 mg", and month names vs numeric months in dates.
 */
import { allSourceText, itemsOf, type CheckResult, type Issue, type VerifyInput } from './types';

const UNITS: Record<string, string> = {
  c: 'degC', '°c': 'degC', '°': 'degC', degc: 'degC', degrees: 'degC', deg: 'degC', celsius: 'degC',
  mg: 'mg', g: 'g', mcg: 'mcg', µg: 'mcg', ug: 'mcg', kg: 'kg', ml: 'ml', l: 'l', iu: 'iu', units: 'iu',
  mmhg: 'mmHg', bpm: 'bpm', '/min': '/min', 'b/min': '/min', 'breaths/min': '/min', 'beats/min': 'bpm',
  '%': '%', percent: '%', cm: 'cm', mm: 'mm', weeks: 'weeks', week: 'weeks', wks: 'weeks', wk: 'weeks',
  days: 'days', day: 'days', months: 'months', month: 'months', years: 'years', year: 'years', yrs: 'years', yr: 'years',
  hours: 'hours', hrs: 'hours', hr: 'hours', tabs: 'tabs', tab: 'tabs', tablets: 'tabs', tablet: 'tabs',
  'g/dl': 'g/dL', 'mmol/l': 'mmol/L', 'mg/dl': 'mg/dL',
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

export type NumberMention = { value: string; unit: string | null };

function canon(n: string): string {
  const x = Number(n.replace(',', '.'));
  return Number.isFinite(x) ? String(x) : n;
}

function unitAfter(rest: string): string | null {
  const m = rest.match(/^\s?(°\s?c|°|[a-zµ%°/]+(?:\/[a-z]+)?)/i);
  if (!m) return null;
  const u = m[1].toLowerCase().replace(/\s/g, '');
  return UNITS[u] ?? null;
}

/** Spoken numbers: "thirty-eight point five", "one hundred and twenty", "two". */
export function wordNumbers(text: string): string[] {
  // Punctuation ends a number: "point five, one hundred" is 5 then 100, not 51.
  return text.split(/[,.;:!?\n]+/).flatMap(wordNumbersInClause);
}

function wordNumbersInClause(text: string): string[] {
  const words = text.toLowerCase().replace(/-/g, ' ').split(/[^a-z]+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let total = 0;
    let cur = 0;
    let used = false;
    let decimals = '';
    while (i < words.length) {
      const w = words[i];
      if (w in SMALL) cur += SMALL[w];
      else if (w in TENS) cur += TENS[w];
      else if (w === 'hundred' && used) cur *= 100;
      else if (w === 'thousand' && used) {
        total += cur * 1000;
        cur = 0;
      } else if (w === 'and' && used && i + 1 < words.length && (words[i + 1] in SMALL || words[i + 1] in TENS)) {
        /* "one hundred and twenty" */
      } else if (w === 'point' && used) {
        i++;
        while (i < words.length && words[i] in SMALL && SMALL[words[i]] < 10) decimals += String(SMALL[words[i++]]);
        break;
      } else break;
      used = true;
      i++;
    }
    if (used) out.push(canon(`${total + cur}${decimals ? `.${decimals}` : ''}`));
    else i++;
  }
  return out;
}

/** Digit numbers with the unit that follows them. "120/80" yields 120 and 80. */
export function numberMentions(text: string): NumberMention[] {
  const out: NumberMention[] = [];
  const re = /(\d+(?:[.,]\d+)?)((?:\/\d+(?:[.,]\d+)?)*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const prev = text[m.index - 1];
    if (prev && /[A-Za-z]/.test(prev) && !/[xX]/.test(prev)) continue; // part of a code like "SpO2", "B12", "G6PD"
    const parts = [m[1], ...m[2].split('/').filter(Boolean)];
    const unit = unitAfter(text.slice(m.index + m[0].length));
    parts.forEach((p, i) => out.push({ value: canon(p), unit: i === parts.length - 1 ? unit : null }));
  }
  return out;
}

function monthsIn(text: string): Set<number> {
  const s = new Set<number>();
  const lower = text.toLowerCase();
  MONTHS.forEach((name, i) => {
    if (new RegExp(`\\b${name.slice(0, 3)}(?:${name.slice(3)})?\\b`).test(lower)) s.add(i + 1);
  });
  // numeric dates d/m/y, d-m-y, y-m-d
  for (const d of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) s.add(Number(d[2]));
  for (const d of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) s.add(Number(d[2]));
  return s;
}

export function checkNumbers(input: VerifyInput): CheckResult {
  const source = allSourceText(input.sources);
  const srcMentions = numberMentions(source);
  const srcValues = new Set([...srcMentions.map((m) => m.value), ...wordNumbers(source)]);
  const srcUnits = new Map<string, Set<string>>();
  for (const m of srcMentions) if (m.unit) (srcUnits.get(m.value) ?? srcUnits.set(m.value, new Set()).get(m.value)!).add(m.unit);
  const srcMonths = monthsIn(source);

  const issues: Issue[] = [];
  for (const item of itemsOf(input)) {
    const field = item.target.kind === 'field' ? input.fields.find((f) => f.key === (item.target as { key: string }).key) : undefined;
    const mentions = numberMentions(item.text);
    const missing = mentions.filter((m) => !srcValues.has(m.value));
    if (missing.length) {
      issues.push({
        target: item.target,
        check: 'numbers',
        kind: 'not_in_source',
        note: `Number not found in the original notes: ${[...new Set(missing.map((m) => m.value))].join(', ')}.`,
        blocking: true,
      });
      continue;
    }
    // Unit consistency (lines only; template fields carry their own unit).
    if (!field) {
      const badUnit = mentions.find((m) => {
        if (!m.unit) return false;
        const units = srcUnits.get(m.value);
        return !units || !units.has(m.unit);
      });
      if (badUnit) {
        issues.push({
          target: item.target,
          check: 'numbers',
          kind: 'not_in_source',
          note: `The unit for ${badUnit.value} is not stated that way in the original notes.`,
          blocking: true,
        });
        continue;
      }
    }
    const outMonths = monthsIn(item.text);
    const strayMonth = [...outMonths].find((mo) => !srcMonths.has(mo));
    if (strayMonth) {
      issues.push({ target: item.target, check: 'numbers', kind: 'not_in_source', note: 'A date in this item does not match the original notes.', blocking: true });
    }
  }
  return { issues };
}
