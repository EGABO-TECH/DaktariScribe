import { z } from 'zod';
import type { TemplateDefinition } from '../templates/definition';
import { allFields } from '../templates/definition';

/** RefinedRecord (spec §4.2). Char offsets point into source.rawText. */
export const sourceSpan = z.object({
  sourceId: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export const flag = z.object({
  kind: z.enum(['unclear_audio', 'illegible', 'unknown_abbreviation', 'possible_conflict', 'not_in_source']),
  note: z.string(),
  /** Set by code verification (never trusted from the model). Blocking flags stop sign-off. */
  blocking: z.boolean().optional(),
  /** Which check raised it. */
  check: z.enum(['spans', 'numbers', 'drugs', 'negation', 'model', 'transcript']).optional(),
  /** Set when the worker accepts or edits the item in review. */
  resolved: z.boolean().optional(),
});

export const refinedLine = z.object({
  text: z.string(),
  spans: z.array(sourceSpan),
  flags: z.array(flag).optional(),
});

export const refinedField = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  spans: z.array(sourceSpan),
  status: z.enum(['recorded', 'not_recorded']),
  flags: z.array(flag).optional(),
});

export const refinedRecord = z.object({
  sections: z.array(z.object({ key: z.string(), lines: z.array(refinedLine) })),
  fields: z.array(refinedField),
  suggestedCodes: z
    .array(
      z.object({
        system: z.enum(['ICD-10', 'ICD-11']),
        code: z.string(),
        label: z.string(),
        forLineIndex: z.number().int(),
        // false when suggested; true once the clinician confirms the code in review.
        confirmed: z.boolean(),
      }),
    )
    .optional(),
});

export type SourceSpan = z.infer<typeof sourceSpan>;
export type Flag = z.infer<typeof flag>;
export type RefinedLine = z.infer<typeof refinedLine>;
export type RefinedField = z.infer<typeof refinedField>;
export type RefinedRecord = z.infer<typeof refinedRecord>;

/** Unresolved blocking flags across lines and fields. Sign-off is disabled while this is > 0. */
export function countBlockingFlags(rec: RefinedRecord): number {
  let n = 0;
  for (const s of rec.sections) for (const l of s.lines) n += (l.flags ?? []).filter((f) => f.blocking && !f.resolved).length;
  for (const f of rec.fields) n += (f.flags ?? []).filter((x) => x.blocking && !x.resolved).length;
  return n;
}

/** Section used for the worker's own notes before any organising (Phase 1 text path). */
export const NOTES_SECTION_KEY = 'clinical_notes';

/**
 * Builds version 1 of a record from a typed note, with no processing at all:
 * every paragraph becomes one line whose span covers exactly that paragraph in the
 * original text, and every template field starts as "not recorded".
 */
/** Multi-source version of recordFromTypedText: paragraphs from every source, in order. */
export function recordFromSources(sources: { id: string; text: string }[], def: TemplateDefinition): RefinedRecord {
  const base = recordFromTypedText(sources[0]?.id ?? 'none', sources[0]?.text ?? '', def);
  for (const src of sources.slice(1)) base.sections[0].lines.push(...recordFromTypedText(src.id, src.text, def).sections[0].lines);
  return base;
}

export function recordFromTypedText(sourceId: string, rawText: string, def: TemplateDefinition): RefinedRecord {
  const lines: RefinedLine[] = [];
  const re = /[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g; // paragraphs separated by blank lines
  for (const m of rawText.matchAll(re)) {
    const text = m[0];
    const lead = text.length - text.trimStart().length;
    const trimmed = text.trim();
    if (!trimmed) continue;
    const start = (m.index ?? 0) + lead;
    lines.push({ text: trimmed, spans: [{ sourceId, start, end: start + trimmed.length }] });
  }
  return {
    sections: [{ key: NOTES_SECTION_KEY, lines }],
    fields: allFields(def).map((f) => ({ key: f.key, value: null, spans: [], status: 'not_recorded' as const })),
  };
}
