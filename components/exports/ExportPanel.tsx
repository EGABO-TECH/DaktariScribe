'use client';

/**
 * Export dialog (spec §5 Phase 5): format, output language with a quality badge, optional
 * appendix of the original notes. Downloads the file directly; nothing is stored in the browser.
 */
import React, { useId, useState } from 'react';
import { EXPORT_LANGUAGES } from '@/lib/i18n/labels';
import type { ExportScope } from '@/lib/exports/data';
import { downloadFile } from '@/lib/download';
import { btn, field } from '@/components/ui/kit';

const FORMATS = [
  { id: 'pdf', label: 'PDF report', hint: 'Print-ready, fixed layout', icon: 'picture_as_pdf', action: 'Download PDF' },
  { id: 'docx', label: 'Word document', hint: 'Editable in Word or Google Docs', icon: 'article', action: 'Download Word document' },
  { id: 'pptx', label: 'Slide deck', hint: 'Summary, charts and record list', icon: 'slideshow', action: 'Download slide deck' },
] as const;

type FormatId = (typeof FORMATS)[number]['id'];

const BADGE: Record<string, { text: string; cls: string }> = {
  reviewed: { text: 'Labels reviewed', cls: 'border-secondary/40 bg-success-container text-on-success-container' },
  draft: { text: 'Labels in review', cls: 'border-flag/40 bg-flag-container text-on-flag-container' },
  english: { text: 'English labels', cls: 'border-outline-variant text-on-surface-variant' },
};

export default function ExportPanel({ scope, single = false, defaultFormat = 'pdf' }: { scope: ExportScope; single?: boolean; defaultFormat?: FormatId }) {
  const uid = useId();
  const [format, setFormat] = useState<FormatId>(defaultFormat);
  const [language, setLanguage] = useState('eng');
  const [originals, setOriginals] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const lang = EXPORT_LANGUAGES.find((l) => l.code === language)!;
  const chosen = FORMATS.find((f) => f.id === format)!;

  const run = async () => {
    setBusy(true);
    setError('');
    setDone('');
    const r = await downloadFile('/api/exports', {
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, format, language, includeOriginals: format !== 'pptx' && originals }),
      },
      fallbackName: `DaktariScribe-export.${format}`,
      errorText: 'The export could not be prepared.',
    });
    if (r.ok) setDone(`${chosen.label} downloaded. Check your downloads folder.`);
    else setError(r.error);
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className={field.label}>Format</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {FORMATS.map((f) => (
            <label
              key={f.id}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-outline-variant px-3 py-2 transition-colors hover:border-outline has-[:checked]:border-secondary has-[:checked]:bg-success-container has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-secondary"
            >
              <input type="radio" name={`${uid}-format`} value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="sr-only" />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary" aria-hidden="true">
                <span className="material-symbols-outlined text-[20px]">{f.icon}</span>
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-on-surface">{f.label}</span>
                <span className="block text-[12px] text-on-surface-variant">{f.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {single && format === 'pptx' && (
          <p className={field.hint}>A deck for one record has a summary and the record list; charts appear when several records have recorded values.</p>
        )}
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-lang`} className={field.label}>
            Language
          </label>
          <select id={`${uid}-lang`} className={field.input} value={language} onChange={(e) => setLanguage(e.target.value)}>
            {EXPORT_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[12px] font-semibold ${BADGE[lang.labels].cls}`}>{BADGE[lang.labels].text}</span>
          {language !== 'eng' && (
            <p className={field.hint}>Notes are automatically translated; numbers, dates, doses and medicine names are kept exactly. The report says it was automatically translated.</p>
          )}
        </div>
        {format !== 'pptx' && (
          <label className="flex min-h-12 cursor-pointer items-center gap-3 self-start rounded-lg border border-outline-variant px-3 py-3 transition-colors hover:border-outline has-[:checked]:border-secondary sm:mt-6">
            <input type="checkbox" checked={originals} onChange={(e) => setOriginals(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--color-secondary)]" />
            <span className="text-[14px] font-semibold text-on-surface">Add the original notes as an appendix</span>
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-error/40 bg-error-container p-3 text-[14px] text-on-error-container">
          {error}
          {/pass/i.test(error) && (
            <>
              {' '}
              <a href="/billing" className="font-semibold underline">
                See passes
              </a>
            </>
          )}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-xl border border-secondary/40 bg-success-container p-3 text-[14px] text-on-success-container">
          {done}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant pt-4">
        <button type="button" onClick={run} disabled={busy} aria-busy={busy} className={btn.primary}>
          <span className={`material-symbols-outlined ${busy ? 'animate-spin' : ''}`} aria-hidden="true">
            {busy ? 'progress_activity' : 'download'}
          </span>
          {busy ? 'Preparing…' : chosen.action}
        </button>
        <span className="text-[13px] text-on-surface-variant">Only signed-off records are included.</span>
      </div>
    </div>
  );
}
