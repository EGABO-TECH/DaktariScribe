/**
 * Pure helpers around refinement: build the prompt from (pseudonymised) sources, and turn the
 * processor's sentence-cited output into a RefinedRecord with exact character spans.
 * No I/O here, so this is shared by the pipeline and the eval harness.
 */
import { pseudonymise, restore, type PseudonymMap } from '@/lib/privacy/pseudonymise';
import { NOTES_SECTION_KEY, type Flag, type RefinedField, type RefinedLine, type RefinedRecord, type SourceSpan } from '@/lib/records/refined-record';
import { splitSentences, type Sentence } from '@/lib/text/sentences';
import { allFields, type TemplateDefinition, type TemplateField } from '@/lib/templates/definition';
import { REFINE_SYSTEM, refineUserMessage } from './prompts/refine';
import type { ModelRefineOutput } from './schemas';

export type RefineSource = { id: string; text: string };
export type CitedSentence = Sentence & { sourceId: string; promptText: string };

export function buildRefinePrompt(sources: RefineSource[], def: TemplateDefinition, respondentRef?: string | null) {
  const map: PseudonymMap = new Map();
  const sentences: CitedSentence[] = [];
  for (const src of sources) {
    for (const s of splitSentences(src.text)) {
      const id = `S${sentences.length + 1}`;
      sentences.push({ ...s, id, sourceId: src.id, promptText: pseudonymise(s.text, { respondentRef, map }).text });
    }
  }
  return { system: REFINE_SYSTEM, user: refineUserMessage(def, sentences), sentences, map };
}

/** Spans for the cited sentences; narrowed to the exact quote when it is found inside them. */
function spansFor(ids: string[], quote: string | null, sentences: CitedSentence[], sources: RefineSource[]): SourceSpan[] {
  const cited = ids.map((id) => sentences.find((s) => s.id === id)).filter((s): s is CitedSentence => Boolean(s));
  if (quote && quote.trim()) {
    const q = quote.trim();
    for (const s of cited) {
      const src = sources.find((x) => x.id === s.sourceId)!;
      const at = src.text.slice(s.start, s.end).indexOf(q);
      if (at >= 0) return [{ sourceId: s.sourceId, start: s.start + at, end: s.start + at + q.length }];
    }
  }
  return cited.map((s) => ({ sourceId: s.sourceId, start: s.start, end: s.end }));
}

const YES = /^(yes|y|true|positive|done|given)$/i;
const NO = /^(no|n|false|negative|not done|not given)$/i;

/** Coerces a field value to its template type; returns a flag instead of guessing. */
export function coerceField(def: TemplateField, raw: string | null): { value: RefinedField['value']; flag?: Flag } {
  if (raw === null || raw.trim() === '') return { value: null };
  const v = raw.trim();
  switch (def.type) {
    case 'number': {
      const m = v.replace(',', '.').match(/^-?\d+(?:\.\d+)?/);
      return m ? { value: Number(m[0]) } : { value: v, flag: { kind: 'possible_conflict', note: 'Value is not a plain number; check it.', blocking: true, check: 'spans' } };
    }
    case 'boolean':
      if (YES.test(v)) return { value: true };
      if (NO.test(v)) return { value: false };
      return { value: v, flag: { kind: 'possible_conflict', note: 'Expected yes or no; check it.', blocking: true, check: 'spans' } };
    case 'choice': {
      const match = def.choices?.find((c) => c.toLowerCase() === v.toLowerCase());
      return match ? { value: match } : { value: v, flag: { kind: 'possible_conflict', note: 'Value is not one of the allowed choices; check it.', blocking: true, check: 'spans' } };
    }
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? { value: v } : { value: v, flag: { kind: 'possible_conflict', note: 'Date is incomplete; check it.', blocking: true, check: 'spans' } };
    default:
      return { value: v };
  }
}

export function toRefinedRecord(
  output: ModelRefineOutput,
  ctx: { sentences: CitedSentence[]; sources: RefineSource[]; def: TemplateDefinition; map: PseudonymMap },
): RefinedRecord {
  const sectionKeys = new Set([...ctx.def.sections.map((s) => s.key), NOTES_SECTION_KEY]);
  const sections = new Map<string, RefinedLine[]>();
  const lineIndex = new Map<string, number[]>(); // "section:idx" in model output -> global index
  let global = 0;

  for (const sec of output.sections) {
    const key = sectionKeys.has(sec.key) ? sec.key : NOTES_SECTION_KEY;
    const list = sections.get(key) ?? [];
    sec.lines.forEach((l, i) => {
      const text = restore(l.text, ctx.map).trim();
      if (!text) return;
      list.push({
        text,
        spans: spansFor(l.sentenceIds, l.quote ? restore(l.quote, ctx.map) : null, ctx.sentences, ctx.sources),
        flags: l.flags.map((f) => ({ kind: f.kind, note: restore(f.note, ctx.map) })),
      });
      lineIndex.set(`${sec.key}:${i}`, [global++]);
    });
    sections.set(key, list);
  }

  const defs = allFields(ctx.def);
  const fields: RefinedField[] = defs.map((d) => {
    const out = output.fields.find((f) => f.key === d.key);
    if (!out || out.status !== 'recorded' || out.value === null) return { key: d.key, value: null, spans: [], status: 'not_recorded' };
    const { value, flag } = coerceField(d, restore(out.value, ctx.map));
    if (value === null) return { key: d.key, value: null, spans: [], status: 'not_recorded' };
    return {
      key: d.key,
      value,
      spans: spansFor(out.sentenceIds, null, ctx.sentences, ctx.sources),
      status: 'recorded',
      ...(flag ? { flags: [flag] } : {}),
    };
  });

  const suggestedCodes = output.suggestedCodes
    .map((c) => {
      const idx = lineIndex.get(`${c.sectionKey}:${c.lineIndex}`)?.[0];
      return idx === undefined ? null : { system: c.system, code: c.code, label: restore(c.label, ctx.map), forLineIndex: idx, confirmed: false as const };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // Order sections as in the template, notes last.
  const ordered = [...ctx.def.sections.map((s) => s.key), NOTES_SECTION_KEY]
    .filter((k) => sections.get(k)?.length)
    .map((k) => ({ key: k, lines: sections.get(k)! }));

  return { sections: ordered, fields, ...(suggestedCodes.length ? { suggestedCodes } : {}) };
}

/**
 * Coverage safety net: any source sentence with content that no line cites is appended to
 * the notes section verbatim (with its exact span), so organising can never drop content.
 */
export function ensureCoverage(rec: RefinedRecord, sentences: CitedSentence[]): RefinedRecord {
  const cited = new Set<string>();
  for (const s of rec.sections)
    for (const l of s.lines)
      for (const sp of l.spans)
        for (const sen of sentences) if (sen.sourceId === sp.sourceId && sp.start < sen.end && sp.end > sen.start) cited.add(sen.id);
  const missing = sentences.filter((s) => !cited.has(s.id) && /[A-Za-z0-9]/.test(s.text));
  if (!missing.length) return rec;
  const notes = rec.sections.find((s) => s.key === NOTES_SECTION_KEY);
  const extra: RefinedLine[] = missing.map((s) => ({
    text: s.text,
    // Verbatim copy of the source sentence: nothing to flag.
    spans: [{ sourceId: s.sourceId, start: s.start, end: s.end }],
  }));
  if (notes) notes.lines.push(...extra);
  else rec.sections.push({ key: NOTES_SECTION_KEY, lines: extra });
  return rec;
}
