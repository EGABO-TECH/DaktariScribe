'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/records/StatusBadge';
import { useOnline } from '@/components/layout/OfflineBanner';
import { draftStore, type Draft, type DraftHeader } from '@/lib/offline/db';
import { INTERVIEW_LANGUAGES } from '@/lib/records/languages';

export type TemplateOption = { id: string; name: string };

type Tab = 'type' | 'record' | 'upload';
type SaveState = { kind: 'idle' } | { kind: 'saved'; at: number } | { kind: 'error' };

const AUTOSAVE_MS = 3000;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function newDraft(templates: TemplateOption[], prev?: DraftHeader): Draft {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    header: {
      templateId: prev?.templateId ?? templates[0]?.id ?? '',
      site: prev?.site ?? '',
      encounterDate: todayIso(),
      respondentRef: '',
      consentObtained: false,
      interviewLanguage: prev?.interviewLanguage ?? 'eng',
    },
    text: '',
    createdAt: now,
    updatedAt: now,
  };
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

const inputCls =
  'w-full min-h-12 rounded-lg border border-outline bg-surface-container-lowest px-3 text-[16px] text-on-surface placeholder:text-on-surface-variant/80 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30';
const labelCls = 'block text-[13px] font-semibold text-on-surface mb-1';

export default function FieldEntry({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const online = useOnline();
  const [tab, setTab] = useState<Tab>('type');
  const [draft, setDraft] = useState<Draft>(() => newDraft(templates));
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [otherDrafts, setOtherDrafts] = useState<Draft[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const refreshDrafts = useCallback(async () => {
    try {
      const all = await draftStore.list();
      setOtherDrafts(all);
    } catch {
      /* IndexedDB unavailable (private mode); capture still works in memory */
    }
  }, []);

  // Resume the most recent draft on this device, if any.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await draftStore.list();
        if (cancelled) return;
        setOtherDrafts(all);
        if (all[0] && !dirty.current) setDraft(all[0]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async () => {
    if (!dirty.current) return;
    const d = draftRef.current;
    if (!d.text.trim() && !d.header.site && !d.header.respondentRef) return; // nothing worth keeping yet
    try {
      const updated = { ...d, updatedAt: Date.now() };
      await draftStore.save(updated);
      dirty.current = false;
      setSaveState({ kind: 'saved', at: updated.updatedAt });
      refreshDrafts();
    } catch {
      setSaveState({ kind: 'error' });
    }
  }, [refreshDrafts]);

  // Autosave every 3 s while there are unsaved changes, and when the tab is hidden.
  useEffect(() => {
    const t = setInterval(persist, AUTOSAVE_MS);
    const onHide = () => document.visibilityState === 'hidden' && persist();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [persist]);

  const update = (patch: Partial<DraftHeader> | { text: string }) => {
    dirty.current = true;
    setErrors([]);
    setDraft((d) => ('text' in patch ? { ...d, text: patch.text } : { ...d, header: { ...d.header, ...patch } }));
  };

  const validate = (): string[] => {
    const e: string[] = [];
    const h = draft.header;
    if (!h.templateId) e.push('Choose a template.');
    if (!h.site.trim()) e.push('Enter the site.');
    if (!h.encounterDate) e.push('Enter the encounter date.');
    if (!h.consentObtained) e.push('Confirm that consent was obtained.');
    if (!draft.text.trim()) e.push('The note is empty.');
    return e;
  };

  const saveDraft = async () => {
    dirty.current = true;
    await persist();
  };

  const startNew = async () => {
    await persist();
    setDraft(newDraft(templates, draft.header));
    setSaveState({ kind: 'idle' });
    setErrors([]);
  };

  const resume = async (d: Draft) => {
    await persist();
    setDraft(d);
    setSaveState({ kind: 'saved', at: d.updatedAt });
    setErrors([]);
  };

  const discard = async (d: Draft) => {
    if (!window.confirm('Delete this draft from this device? This cannot be undone.')) return;
    await draftStore.remove(d.id);
    if (d.id === draft.id) setDraft(newDraft(templates, draft.header));
    refreshDrafts();
  };

  const processNote = async () => {
    const e = validate();
    setErrors(e);
    if (e.length) return;
    dirty.current = true;
    await persist();
    if (!online) {
      setErrors(['You are offline. The draft is saved on this device. Process it when you are back online.']);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: draft.id,
          templateId: draft.header.templateId,
          site: draft.header.site,
          encounterDate: draft.header.encounterDate,
          respondentRef: draft.header.respondentRef,
          consentObtained: draft.header.consentObtained,
          interviewLanguage: draft.header.interviewLanguage,
          text: draft.text,
          deviceCreatedAt: new Date(draft.createdAt).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const issues: string[] = (data.issues ?? []).map((i: { message: string }) => i.message);
        setErrors(issues.length ? issues : [data.error ?? 'Could not process the note. Your draft is still saved on this device.']);
        return;
      }
      await draftStore.remove(draft.id);
      router.push(`/records/${encodeURIComponent(data.id)}`);
    } catch {
      setErrors(['Connection lost. Your draft is still saved on this device. Try again when you are back online.']);
    } finally {
      setSubmitting(false);
    }
  };

  const words = useMemo(() => (draft.text.trim() ? draft.text.trim().split(/\s+/).length : 0), [draft.text]);
  const drafts = otherDrafts.filter((d) => d.id !== draft.id);

  if (!templates.length) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-1">No templates available</h2>
        <p className="text-body-md text-on-surface-variant">
          Templates have not been set up for this workspace yet. Ask an administrator to run the template seed (npm run db:seed).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gutter pb-28 lg:pb-0">
      {/* Encounter details */}
      <section aria-labelledby="enc-details" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="enc-details" className="font-headline-sm text-headline-sm text-primary">
            Encounter details
          </h2>
          <button type="button" onClick={startNew} className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-3 text-[14px] font-semibold text-secondary hover:bg-secondary/10">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              add
            </span>
            New encounter
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="tpl" className={labelCls}>
              Template
            </label>
            <select id="tpl" className={inputCls} value={draft.header.templateId} onChange={(e) => update({ templateId: e.target.value })}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="site" className={labelCls}>
              Site
            </label>
            <input
              id="site"
              className={inputCls}
              value={draft.header.site}
              onChange={(e) => update({ site: e.target.value })}
              onBlur={persist}
              placeholder="e.g. Kiryandongo HC III"
              autoComplete="off"
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="date" className={labelCls}>
              Encounter date
            </label>
            <input id="date" type="date" className={inputCls} value={draft.header.encounterDate} max={todayIso()} onChange={(e) => update({ encounterDate: e.target.value })} />
          </div>
          <div>
            <label htmlFor="ref" className={labelCls}>
              Respondent reference <span className="font-normal text-on-surface-variant">(optional)</span>
            </label>
            <input
              id="ref"
              className={inputCls}
              value={draft.header.respondentRef}
              onChange={(e) => update({ respondentRef: e.target.value })}
              onBlur={persist}
              placeholder="Local ID, not a name"
              autoComplete="off"
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="lang" className={labelCls}>
              Interview language
            </label>
            <select id="lang" className={inputCls} value={draft.header.interviewLanguage} onChange={(e) => update({ interviewLanguage: e.target.value })}>
              {INTERVIEW_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg border border-outline px-3 has-[:checked]:border-secondary has-[:checked]:bg-success-container">
              <input
                type="checkbox"
                className="h-6 w-6 shrink-0 accent-[var(--color-secondary)]"
                checked={draft.header.consentObtained}
                onChange={(e) => update({ consentObtained: e.target.checked })}
              />
              <span className="text-[14px] font-semibold text-on-surface">Consent obtained from the respondent</span>
            </label>
          </div>
        </div>
      </section>

      {/* Capture */}
      <section aria-label="Capture" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
        <div role="tablist" aria-label="Capture method" className="mb-4 inline-flex rounded-lg border border-outline-variant bg-surface-container-low p-1">
          {(
            [
              { id: 'type', label: 'Type', icon: 'keyboard', ready: true },
              { id: 'record', label: 'Record', icon: 'mic', ready: false },
              { id: 'upload', label: 'Upload', icon: 'upload_file', ready: false },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`inline-flex min-h-12 items-center gap-1.5 rounded-md px-4 text-[14px] font-semibold transition-colors ${
                tab === t.id ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
              {!t.ready && <span className="sr-only"> (coming soon)</span>}
            </button>
          ))}
        </div>

        {tab === 'type' ? (
          <div role="tabpanel" id="panel-type" aria-labelledby="tab-type">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="note" className="text-[13px] font-semibold text-on-surface">
                Clinical notes
              </label>
              <div className="flex items-center gap-2 text-[13px] text-on-surface-variant" aria-live="polite">
                {saveState.kind === 'saved' && (
                  <>
                    <StatusBadge status="saved_on_device" />
                    <span>{timeFmt.format(saveState.at)}</span>
                  </>
                )}
                {saveState.kind === 'error' && <span className="font-semibold text-error">Could not save on this device</span>}
                <span>{words} words</span>
              </div>
            </div>
            <textarea
              id="note"
              value={draft.text}
              onChange={(e) => update({ text: e.target.value })}
              onBlur={persist}
              rows={14}
              spellCheck
              placeholder={'Type the encounter as you would on paper.\nLeave a blank line between paragraphs.'}
              className="w-full min-h-[320px] resize-y rounded-lg border border-outline bg-surface-container-lowest p-4 text-[16px] leading-7 text-on-surface placeholder:text-on-surface-variant/80 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30"
            />
            <p className="mt-2 text-[13px] text-on-surface-variant">
              Your original note is stored exactly as typed. You review the record and sign it off before it becomes final.
            </p>
          </div>
        ) : (
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="rounded-lg border border-dashed border-outline p-8 text-center">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant" aria-hidden="true">
              {tab === 'record' ? 'mic' : 'upload_file'}
            </span>
            <p className="mt-2 font-semibold text-on-surface">{tab === 'record' ? 'Voice recording' : 'Upload notes'} is coming soon</p>
            <p className="mt-1 text-[14px] text-on-surface-variant">Use the Type tab for now.</p>
          </div>
        )}

        {errors.length > 0 && (
          <div role="alert" className="mt-4 rounded-lg border border-error bg-error-container p-3 text-[14px] text-on-error-container">
            <p className="font-semibold">Before you continue:</p>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions: sticky at the bottom on phones, above the bottom nav */}
        <div className="fixed inset-x-0 bottom-16 z-40 flex gap-3 border-t border-outline-variant bg-surface-container-lowest p-3 lg:static lg:mt-4 lg:justify-end lg:border-0 lg:bg-transparent lg:p-0">
          <button
            type="button"
            onClick={saveDraft}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-secondary px-5 font-semibold text-secondary hover:bg-secondary/10 lg:flex-none"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              save
            </span>
            Save draft
          </button>
          <button
            type="button"
            onClick={processNote}
            disabled={submitting || tab !== 'type'}
            className="inline-flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-lg bg-primary px-6 font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 lg:flex-none"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {submitting ? 'hourglass_top' : 'arrow_forward'}
            </span>
            {submitting ? 'Processing…' : 'Process'}
          </button>
        </div>
      </section>

      {drafts.length > 0 && (
        <section aria-labelledby="device-drafts" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
          <h2 id="device-drafts" className="font-headline-sm text-headline-sm text-primary mb-3">
            Drafts on this device
          </h2>
          <ul className="divide-y divide-outline-variant">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-on-surface">{d.header.site || 'No site yet'}</p>
                  <p className="text-[13px] text-on-surface-variant">
                    {d.header.encounterDate} · edited {timeFmt.format(d.updatedAt)} · {d.text.trim() ? d.text.trim().split(/\s+/).length : 0} words
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => resume(d)} className="min-h-12 rounded-lg px-4 font-semibold text-secondary hover:bg-secondary/10">
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => discard(d)}
                    className="min-h-12 rounded-lg px-4 font-semibold text-error hover:bg-error/10"
                    aria-label={`Delete draft for ${d.header.site || 'untitled'}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
