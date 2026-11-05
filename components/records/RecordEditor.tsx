'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RefinedLine, RefinedRecord } from '@/lib/records/refined-record';
import { NOTES_SECTION_KEY } from '@/lib/records/refined-record';
import type { TemplateDefinition, TemplateField } from '@/lib/templates/definition';
import { labelFor } from '@/lib/templates/definition';

type FieldValue = string | number | boolean | null;

const inputCls =
  'w-full min-h-12 rounded-lg border border-outline bg-surface-container-lowest px-3 text-[16px] text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30';

/** Splits edited notes into lines, keeping the source spans of any paragraph left unchanged. */
export function rebuildNoteLines(edited: string, previous: RefinedLine[]): RefinedLine[] {
  const byText = new Map(previous.map((l) => [l.text, l]));
  return edited
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => byText.get(text) ?? { text, spans: [] });
}

function parseValue(field: TemplateField, raw: string): FieldValue {
  if (raw === '') return null;
  if (field.type === 'number') {
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  if (field.type === 'boolean') return raw === 'true';
  return raw;
}

function FieldInput({ field, value, onChange }: { field: TemplateField; value: FieldValue; onChange: (v: FieldValue) => void }) {
  const id = `f-${field.key}`;
  const str = value === null || value === undefined ? '' : String(value);
  const label = (
    <label htmlFor={id} className="mb-1 block text-[13px] font-semibold text-on-surface">
      {labelFor(field.label)}
      {field.unit ? <span className="font-normal text-on-surface-variant"> ({field.unit})</span> : null}
    </label>
  );
  if (field.type === 'boolean' || field.type === 'choice') {
    const opts = field.type === 'boolean' ? [{ v: 'true', l: 'Yes' }, { v: 'false', l: 'No' }] : (field.choices ?? []).map((c) => ({ v: c, l: c }));
    return (
      <div>
        {label}
        <select id={id} className={inputCls} value={str} onChange={(e) => onChange(parseValue(field, e.target.value))}>
          <option value="">Not recorded</option>
          {opts.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div>
      {label}
      <input
        id={id}
        className={inputCls}
        type={field.type === 'date' ? 'date' : 'text'}
        inputMode={field.type === 'number' ? 'decimal' : undefined}
        value={str}
        placeholder="Not recorded"
        onChange={(e) => onChange(field.type === 'number' ? (e.target.value === '' ? null : e.target.value) : parseValue(field, e.target.value))}
        onBlur={(e) => field.type === 'number' && onChange(parseValue(field, e.target.value))}
      />
    </div>
  );
}

export default function RecordEditor({
  recordId,
  baseVersionId,
  content,
  definition,
  onCancel,
}: {
  recordId: string;
  baseVersionId: string;
  content: RefinedRecord;
  definition: TemplateDefinition;
  onCancel: () => void;
}) {
  const router = useRouter();
  const prevNotes = content.sections.find((s) => s.key === NOTES_SECTION_KEY)?.lines ?? [];
  const [notes, setNotes] = useState(prevNotes.map((l) => l.text).join('\n\n'));
  const [values, setValues] = useState<Record<string, FieldValue>>(() => Object.fromEntries(content.fields.map((f) => [f.key, f.value])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    const sections = [
      { key: NOTES_SECTION_KEY, lines: rebuildNoteLines(notes, prevNotes) },
      ...content.sections.filter((s) => s.key !== NOTES_SECTION_KEY),
    ];
    const fields = content.fields.map((f) => {
      const v = values[f.key];
      const def = definition.sections.flatMap((s) => s.fields).find((x) => x.key === f.key);
      const value = def && typeof v === 'string' ? parseValue(def, v) : (v ?? null);
      const changed = value !== f.value;
      return {
        key: f.key,
        value,
        spans: changed ? [] : f.spans,
        status: value === null ? ('not_recorded' as const) : ('recorded' as const),
      };
    });
    try {
      const res = await fetch(`/api/encounters/${encodeURIComponent(recordId)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseVersionId, content: { ...content, sections, fields } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not save changes.');
        return;
      }
      onCancel();
      router.refresh();
    } catch {
      setError('Connection lost. Changes were not saved.');
    } finally {
      setBusy(false);
    }
  };

  const fieldSections = definition.sections.filter((s) => s.fields.length);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label htmlFor="edit-notes" className="mb-1 block text-[13px] font-semibold text-on-surface">
          Clinical notes
        </label>
        <textarea
          id="edit-notes"
          rows={10}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full resize-y rounded-lg border border-outline bg-surface-container-lowest p-3 text-[16px] leading-7 text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
        />
        <p className="mt-1 text-[13px] text-on-surface-variant">Leave a blank line between paragraphs. The original note is not changed.</p>
      </div>
      {fieldSections.map((sec) => (
        <fieldset key={sec.key} className="rounded-lg border border-outline-variant p-4">
          <legend className="px-1 font-semibold text-primary">{labelFor(sec.label)}</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sec.fields.map((f) => (
              <FieldInput key={f.key} field={f} value={values[f.key] ?? null} onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))} />
            ))}
          </div>
        </fieldset>
      ))}
      {error && (
        <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-[14px] text-on-error-container">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-6 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-60"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            save
          </span>
          {busy ? 'Saving…' : 'Save as new version'}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex min-h-12 items-center rounded-lg px-5 font-semibold text-on-surface hover:bg-surface-container-high">
          Cancel
        </button>
      </div>
    </div>
  );
}
