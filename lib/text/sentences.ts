/** Splits source text into sentences with stable character offsets into the original string. */
export type Sentence = { id: string; start: number; end: number; text: string };

export function splitSentences(raw: string): Sentence[] {
  const out: Sentence[] = [];
  // A sentence ends at a line break, or at . ! ? followed by whitespace or the end of text.
  // Decimal points ("38.5") and "B/S." mid-word are therefore not boundaries.
  let segStart = 0;
  const flush = (end: number) => {
    const text = raw.slice(segStart, end);
    const lead = text.length - text.trimStart().length;
    const trimmed = text.trim();
    if (trimmed) {
      const start = segStart + lead;
      out.push({ id: `S${out.length + 1}`, start, end: start + trimmed.length, text: trimmed });
    }
  };
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\n') {
      flush(i);
      segStart = i + 1;
    } else if ((c === '.' || c === '!' || c === '?') && (i + 1 === raw.length || /\s/.test(raw[i + 1]))) {
      flush(i + 1);
      segStart = i + 1;
    }
  }
  flush(raw.length);
  return out;
}

const STOP = new Set(
  'a an the and or of to in on at for with by is was were be been are has have had this that it its as from patient pt he she they his her their'.split(
    ' ',
  ),
);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.%/\s-]/g, ' ')
    .split(/[\s/-]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter((t) => t.length > 0);
}

export function meaningfulTokens(text: string): string[] {
  return tokens(text).filter((t) => !STOP.has(t) && (t.length > 1 || /\d/.test(t)));
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
