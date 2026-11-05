'use client';

/**
 * Export dialog (spec §5 Phase 5): format, output language with a quality badge, optional
 * appendix of the original notes. Downloads the file directly; nothing is stored in the browser.
 */
import React, { useState } from 'react';
import { EXPORT_LANGUAGES } from '@/lib/i18n/labels';
import type { ExportScope } from '@/lib/exports/data';

const FORMATS = [
  { id: 'pdf', label: 'PDF report', icon: 'picture_as_pdf' },
  { id: 'docx', label: 'Word document', icon: 'description' },
  { id: 'pptx', label: 'Slide deck', icon: 'slideshow' },
] as const;

const BADGE: Record<string, { text: string; cls: string }> = {
  reviewed: { text: 'Labels reviewed', cls: 'border-secondary text-secondary' },
  draft: { text: 'Labels in review', cls: 'border-flag text-on-flag-container bg-flag-container' },
  english: { text: 'English labels', cls: 'border-outline text-on-surface-variant' },
};

const fieldCls = 'w-full min-h-12 rounded-lg border border-outline bg-surface-container-lowest px-3 text-[16px] text-on-surface';

export default function ExportPanel({ scope, single = false, defaultFormat = 'pdf' }: { scope: ExportScope; single?: boolean; defaultFormat?: 'pdf' | 'docx' | 'pptx' }) {
  const [format, setFormat] = useState<(typeof FORMATS)[number]['id']>(defaultFormat);
  const [language, setLanguage] = useState('eng');
  const [originals, setOriginals] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lang = EXPORT_LANGUAGES.find((l) => l.code === language)!;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, format, language, includeOriginals: originals }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'The export could not be prepared.');
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `export.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError('Connection lost. The export was not downloaded.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-outline-variant p-4">
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-on-surface">Format</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {FORMATS.map((f) => (
            <label key={f.id} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-outline px-3 has-[:checked]:border-secondary has-[:checked]:bg-success-container">
              <input type="radio" name="format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="h-5 w-5 accent-[var(--color-secondary)]" />
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {f.icon}
              </span>
              <span className="font-semibold text-on-surface">{f.label}</span>
            </label>
          ))}
        </div>
        {single && format === 'pptx' && <p className="mt-2 text-[13px] text-on-surface-variant">A deck for one record has a summary and the record list; charts appear when several records have recorded values.</p>}
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="exp-lang" className="mb-1 block text-[13px] font-semibold text-on-surface">
            Language
          </label>
          <select id="exp-lang" className={fieldCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
            {EXPORT_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[12px] font-semibold ${BADGE[lang.labels].cls}`}>{BADGE[lang.labels].text}</span>
          {language !== 'eng' && <p className="mt-1 text-[13px] text-on-surface-variant">Notes are automatically translated; numbers, dates, doses and medicine names are kept exactly. The report says it was automatically translated.</p>}
        </div>
        {format !== 'pptx' && (
          <label className="flex min-h-12 cursor-pointer items-center gap-3 self-end rounded-lg border border-outline px-3">
            <input type="checkbox" checked={originals} onChange={(e) => setOriginals(e.target.checked)} className="h-5 w-5 accent-[var(--color-secondary)]" />
            <span className="text-[14px] font-semibold text-on-surface">Add the original notes as an appendix</span>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-[14px] text-on-error-container">
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
      <button type="button" onClick={run} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-lg bg-primary px-6 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-60">
        <span className="material-symbols-outlined" aria-hidden="true">
          download
        </span>
        {busy ? 'Preparing…' : 'Download'}
      </button>
    </div>
  );
}
