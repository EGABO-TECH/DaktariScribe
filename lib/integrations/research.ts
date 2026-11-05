/**
 * Research licence export (spec §7.7 — stub for a later phase).
 * Produces a Stata/SPSS-friendly CSV of confirmed field values (one row per Final record,
 * snake_case columns, no free text, no names) plus a codebook describing each column.
 */
import type { TemplateDefinition } from '@/lib/templates/definition';
import { labelFor } from '@/lib/templates/definition';

export type CodebookEntry = { column: string; label: string; type: string; unit?: string; values?: string[] };

export function codebook(def: TemplateDefinition): CodebookEntry[] {
  const base: CodebookEntry[] = [
    { column: 'record_id', label: 'Record ID', type: 'string' },
    { column: 'encounter_date', label: 'Encounter date (YYYY-MM-DD)', type: 'date' },
    { column: 'site', label: 'Site', type: 'string' },
  ];
  return base.concat(
    def.sections.flatMap((s) =>
      s.fields.map((f) => ({
        column: f.key,
        label: labelFor(f.label),
        type: f.type === 'boolean' ? 'binary (1=yes, 0=no)' : f.type,
        unit: f.unit,
        values: f.choices,
      })),
    ),
  );
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n');
}
