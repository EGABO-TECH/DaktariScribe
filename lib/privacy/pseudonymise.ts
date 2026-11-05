/**
 * Pseudonymiser (spec §0.2 rule 4, §5 Phase 6.1). Runs before any text leaves the server for
 * an external processor (text processing, translation). Replaces likely identifiers with
 * stable placeholders such as ⟦PERSON_1⟧ and returns a map to restore them afterwards.
 * The map lives only in memory for the duration of one request and is never stored or logged.
 *
 * Detects: the encounter's respondent reference, phone numbers (+256…, 07…, 256…),
 * Uganda NIN patterns (CM/CF + 12 alphanumerics), email addresses, and person names that
 * follow a title or naming phrase ("Mr Okello", "Nurse Achieng", "named Sarah"). Free-text
 * names without such a cue cannot be found reliably by pattern; audio cannot be pseudonymised.
 */
export type PseudonymMap = Map<string, string>; // placeholder -> original

const OPEN = '⟦';
const CLOSE = '⟧';

const PATTERNS: { kind: string; re: RegExp; group?: number }[] = [
  { kind: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'NIN', re: /\bC[MF][A-Z0-9]{12}\b/g },
  { kind: 'PHONE', re: /(?:\+?256[\s-]?|\b0)7\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g },
  {
    kind: 'PERSON',
    re: /\b(?:Mr|Mrs|Ms|Miss|Mzee|Maama|Jajja|Dr|Doctor|Nurse|Sr|Sister|Pastor|Hon)\.?\s+((?:[A-Z][a-z'’-]+)(?:\s+[A-Z][a-z'’-]+){0,2})/g,
    group: 1,
  },
  {
    kind: 'PERSON',
    re: /\b(?:name is|named|called|names are|mother is|father is|husband is|wife is|caretaker is|guardian is)\s+((?:[A-Z][a-z'’-]+)(?:\s+[A-Z][a-z'’-]+){0,2})/g,
    group: 1,
  },
];

export type Pseudonymised = { text: string; map: PseudonymMap };

export function pseudonymise(text: string, opts: { respondentRef?: string | null; map?: PseudonymMap } = {}): Pseudonymised {
  const map: PseudonymMap = opts.map ?? new Map();
  const reverse = new Map<string, string>();
  for (const [ph, orig] of map) reverse.set(orig, ph);
  const counters = new Map<string, number>();
  for (const ph of map.keys()) {
    const m = ph.match(/^⟦([A-Z]+)_(\d+)⟧$/);
    if (m) counters.set(m[1], Math.max(counters.get(m[1]) ?? 0, Number(m[2])));
  }
  const placeholderFor = (kind: string, original: string) => {
    const existing = reverse.get(original);
    if (existing) return existing;
    const n = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, n);
    const ph = `${OPEN}${kind}_${n}${CLOSE}`;
    map.set(ph, original);
    reverse.set(original, ph);
    return ph;
  };

  let out = text;
  const ref = opts.respondentRef?.trim();
  if (ref && ref.length >= 3) {
    const re = new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    out = out.replace(re, () => placeholderFor('REF', ref));
  }
  for (const p of PATTERNS) {
    out = out.replace(p.re, (whole, ...groups) => {
      if (p.group) {
        const name = groups[p.group - 1] as string;
        if (!name) return whole;
        return whole.replace(name, placeholderFor(p.kind, name));
      }
      return placeholderFor(p.kind, whole);
    });
  }
  return { text: out, map };
}

/** Restores placeholders. Unknown placeholders are left as-is so they are visible in review. */
export function restore(text: string, map: PseudonymMap): string {
  return text.replace(/⟦[A-Z]+_\d+⟧/g, (ph) => map.get(ph) ?? ph);
}

/** Recursively restores every string in a JSON-like value. */
export function restoreDeep<T>(value: T, map: PseudonymMap): T {
  if (typeof value === 'string') return restore(value, map) as T;
  if (Array.isArray(value)) return value.map((v) => restoreDeep(v, map)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreDeep(v, map)])) as T;
  }
  return value;
}
