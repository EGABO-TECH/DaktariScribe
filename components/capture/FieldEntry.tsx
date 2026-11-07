'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/records/StatusBadge';
import { useOnline } from '@/components/layout/OfflineBanner';
import PinGate from '@/components/offline/PinGate';
import { useDevice } from '@/components/offline/DeviceProvider';
import Recorder from './Recorder';
import UploadPicker from './UploadPicker';
import DraftPdfButton from './DraftPdfButton';
import { Alert, btn, EmptyState, field, Icon } from '@/components/ui/kit';
import { db, draftStore, type Draft, type DraftHeader } from '@/lib/offline/db';
import { discard as discardOutbox, enqueue, onOutboxChange, pendingItems, retry, type OutboxView } from '@/lib/offline/outbox';
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
    segments: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

const inputCls = field.input;
const labelCls = field.label;

function StepHeading({ n, id, title, hint, children }: { n: number; id: string; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-on-primary" aria-hidden="true">
          {n}
        </span>
        <div>
          <h2 id={id} className="font-headline-sm text-[18px] font-semibold leading-8 text-primary">
            <span className="sr-only">Step {n}: </span>
            {title}
          </h2>
          <p className="text-body-md text-on-surface-variant">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

const cardCls = 'rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-[0_1px_2px_rgba(0,29,61,0.04)] md:p-6';

const OUTBOX_LABEL: Record<OutboxView['status'], string> = {
  queued: 'Waiting to upload',
  creating: 'Uploading',
  uploading: 'Uploading',
  completing: 'Uploading',
  done: 'Uploaded',
  failed: 'Needs attention',
};

function hasContent(d: Draft) {
  return Boolean(d.text.trim() || d.segments.length || d.attachments.length);
}

export default function FieldEntry({ templates }: { templates: TemplateOption[] }) {
  return (
    <PinGate>
      <Capture templates={templates} />
    </PinGate>
  );
}

function Capture({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const online = useOnline();
  const { pending } = useDevice();
  const [tab, setTab] = useState<Tab>('type');
  const [draft, setDraft] = useState<Draft>(() => newDraft(templates));
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [otherDrafts, setOtherDrafts] = useState<Draft[]>([]);
  const [queue, setQueue] = useState<OutboxView[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const refreshLists = useCallback(async () => {
    try {
      setOtherDrafts(await draftStore.list());
      setQueue(await pendingItems());
    } catch {
      /* locked or storage unavailable */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await draftStore.list();
        if (cancelled) return;
        setOtherDrafts(all);
        if (all[0] && !dirty.current) setDraft(all[0]);
        setQueue(await pendingItems());
      } catch {
        /* ignore */
      }
    })();
    const off = onOutboxChange(() => void refreshLists());
    return () => {
      cancelled = true;
      off();
    };
  }, [refreshLists]);

  const persist = useCallback(async () => {
    if (!dirty.current) return;
    const d = draftRef.current;
    if (!hasContent(d) && !d.header.site && !d.header.respondentRef) return;
    try {
      const updated = { ...d, updatedAt: Date.now() };
      await draftStore.save(updated);
      dirty.current = false;
      setSaveState({ kind: 'saved', at: updated.updatedAt });
      void refreshLists();
    } catch {
      setSaveState({ kind: 'error' });
    }
  }, [refreshLists]);

  useEffect(() => {
    const t = setInterval(persist, AUTOSAVE_MS);
    const onHide = () => document.visibilityState === 'hidden' && persist();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [persist]);

  const update = (patch: Partial<DraftHeader> | { text: string } | Pick<Draft, 'segments'> | Pick<Draft, 'attachments'>) => {
    dirty.current = true;
    setErrors([]);
    setNotice('');
    setDraft((d) => {
      if ('text' in patch || 'segments' in patch || 'attachments' in patch) return { ...d, ...patch };
      return { ...d, header: { ...d.header, ...patch } };
    });
  };

  // Segments/attachments are written to storage as they are captured: save the draft right away.
  const updateMedia = (patch: Pick<Draft, 'segments'> | Pick<Draft, 'attachments'>) => {
    update(patch);
    dirty.current = true;
    setTimeout(() => void persist(), 0);
  };

  const validate = (): string[] => {
    const e: string[] = [];
    const h = draft.header;
    if (!h.templateId) e.push('Choose a template.');
    if (!h.site.trim()) e.push('Enter the site.');
    if (!h.encounterDate) e.push('Enter the encounter date.');
    if (!h.consentObtained) e.push('Confirm that consent was obtained.');
    if (!hasContent(draft)) e.push('Type a note, record the interview or attach a file first.');
    return e;
  };

  const startNew = async () => {
    await persist();
    setDraft(newDraft(templates, draft.header));
    setSaveState({ kind: 'idle' });
    setErrors([]);
    setNotice('');
  };

  const resume = async (d: Draft) => {
    await persist();
    setDraft(d);
    setSaveState({ kind: 'saved', at: d.updatedAt });
    setErrors([]);
  };

  const discardDraft = async (d: Draft) => {
    if (!window.confirm('Delete this draft and its recordings from this device? This cannot be undone.')) return;
    await draftStore.remove(d.id);
    if (d.id === draft.id) setDraft(newDraft(templates, draft.header));
    void refreshLists();
  };

  /** Process: queue the draft in the outbox. It syncs now if online, or as soon as the device reconnects. */
  const processNote = async () => {
    const e = validate();
    setErrors(e);
    if (e.length) return;
    setSubmitting(true);
    const id = draft.id;
    try {
      await enqueue({ ...draft, updatedAt: Date.now() });
      dirty.current = false;
      setDraft(newDraft(templates, draft.header));
      setSaveState({ kind: 'idle' });
      void refreshLists();
      if (!navigator.onLine) {
        setNotice('Saved on this device and queued. It will upload automatically when you are back online.');
        return;
      }
      setNotice('Uploading… you can start the next encounter.');
      // If it finishes quickly, open the record.
      const started = Date.now();
      const check = async () => {
        const meta = (await db().meta.get('recentSynced'))?.value as { id: string; encounterId: string }[] | undefined;
        const hit = meta?.find((m) => m.id === id);
        if (hit) {
          router.push(`/records/${encodeURIComponent(hit.encounterId)}`);
          return;
        }
        if (Date.now() - started < 20_000) setTimeout(check, 1000);
        else setNotice('Still uploading in the background. You will find the record in Saved Records when it finishes.');
      };
      setTimeout(check, 800);
    } catch {
      setErrors(['Could not queue this encounter on the device. Try again.']);
    } finally {
      setSubmitting(false);
    }
  };

  const words = useMemo(() => (draft.text.trim() ? draft.text.trim().split(/\s+/).length : 0), [draft.text]);
  const drafts = otherDrafts.filter((d) => d.id !== draft.id);

  if (!templates.length) {
    return (
      <div className={cardCls}>
        <EmptyState icon="assignment" title="No templates available">
          Templates have not been set up for this workspace yet. Ask an administrator to run the template seed.
        </EmptyState>
      </div>
    );
  }

  const tabs = [
    { id: 'type', label: 'Type', icon: 'keyboard', count: words ? 1 : 0 },
    { id: 'record', label: 'Record', icon: 'mic', count: draft.segments.length },
    { id: 'upload', label: 'Upload', icon: 'upload_file', count: draft.attachments.length },
  ] as const;

  return (
    <div className="flex flex-col gap-6 pb-28 lg:pb-0">
      {notice && <Alert tone="success">{notice}</Alert>}

      {/* Encounter details */}
      <section aria-labelledby="enc-details" className={cardCls} data-tour="encounter-details">
        <StepHeading n={1} id="enc-details" title="Encounter details" hint="Who, where and when. Use a local ID, never a name.">
          <button type="button" onClick={startNew} className={btn.ghost}>
            <Icon name="add" className="text-[20px]" />
            New encounter
          </button>
        </StepHeading>
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
            <input id="site" className={inputCls} value={draft.header.site} onChange={(e) => update({ site: e.target.value })} onBlur={persist} placeholder="e.g. Kiryandongo HC III" autoComplete="off" maxLength={120} />
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
            <input id="ref" className={inputCls} value={draft.header.respondentRef} onChange={(e) => update({ respondentRef: e.target.value })} onBlur={persist} placeholder="Local ID, not a name" autoComplete="off" maxLength={80} />
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
            <label className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg border border-outline-variant px-3 transition-colors hover:border-outline has-[:checked]:border-secondary has-[:checked]:bg-success-container">
              <input type="checkbox" className="h-6 w-6 shrink-0 accent-[var(--color-secondary)]" checked={draft.header.consentObtained} onChange={(e) => update({ consentObtained: e.target.checked })} />
              <span className="text-[14px] font-semibold text-on-surface">Consent obtained from the respondent</span>
            </label>
          </div>
        </div>
      </section>

      {/* Capture */}
      <section aria-labelledby="capture-h" className={cardCls}>
        <StepHeading n={2} id="capture-h" title="Capture the notes" hint="Type, record your voice, or upload photos and documents. You can combine them." />
        <div role="tablist" aria-label="Capture method" data-tour="capture-methods" className="mb-5 grid grid-cols-3 rounded-lg border border-outline-variant bg-surface-container-low p-1 sm:inline-grid">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`inline-flex min-h-12 items-center justify-center gap-1.5 rounded-md px-4 text-[14px] font-semibold transition-colors ${
                tab === t.id ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
              {t.count > 0 && <span className="rounded-full bg-surface-container-highest px-1.5 text-[12px] text-on-surface">{t.count}</span>}
            </button>
          ))}
        </div>

        {tab === 'type' && (
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
                <DraftPdfButton draft={draft} templateName={templates.find((t) => t.id === draft.header.templateId)?.name ?? ''} />
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
              className="w-full min-h-[320px] resize-y rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-[16px] leading-7 text-on-surface placeholder:text-on-surface-variant/80 transition-colors hover:border-outline focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/25"
            />
          </div>
        )}
        {tab === 'record' && (
          <div role="tabpanel" id="panel-record" aria-labelledby="tab-record">
            <Recorder draftId={draft.id} segments={draft.segments} onSegmentsChange={(segments) => updateMedia({ segments })} />
          </div>
        )}
        {tab === 'upload' && (
          <div role="tabpanel" id="panel-upload" aria-labelledby="tab-upload">
            <UploadPicker draftId={draft.id} attachments={draft.attachments} onChange={(attachments) => updateMedia({ attachments })} />
          </div>
        )}

        <p className="mt-3 flex items-start gap-2 text-[13px] text-on-surface-variant">
          <Icon name="lock" className="text-[16px]" />
          Your notes, recordings and files are kept exactly as captured. You review the record and sign it off before it becomes final.
        </p>

        {errors.length > 0 && (
          <div className="mt-4">
            <Alert tone="error" title="Before you continue:">
              <ul className="list-disc pl-5">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          </div>
        )}

        <div className="fixed inset-x-0 bottom-16 z-40 flex gap-3 border-t border-outline-variant bg-surface-container-lowest p-3 shadow-[0_-4px_12px_rgba(0,29,61,0.06)] lg:static lg:mt-6 lg:justify-end lg:border-t lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-5 lg:shadow-none">
          <button
            type="button"
            onClick={() => {
              dirty.current = true;
              void persist();
            }}
            className={`${btn.outline} flex-1 lg:flex-none`}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              save
            </span>
            Save draft
          </button>
          <button
            type="button"
            onClick={processNote}
            disabled={submitting}
            data-tour="process-button"
            className={`${btn.primary} flex-[1.4] px-6 lg:flex-none`}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {online ? 'arrow_forward' : 'schedule_send'}
            </span>
            {submitting ? 'Saving…' : online ? 'Process' : 'Process when online'}
          </button>
        </div>
      </section>

      {queue.length > 0 && (
        <section aria-labelledby="queue-h" className={cardCls}>
          <h2 id="queue-h" className="mb-3 flex items-center gap-2 font-headline-sm text-[18px] font-semibold text-primary">
            <Icon name="cloud_upload" className="text-secondary" />
            Waiting to upload <span className="rounded-full bg-surface-container-high px-2 text-[13px] font-semibold text-on-surface-variant">{pending}</span>
          </h2>
          <ul className="divide-y divide-outline-variant">
            {queue.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-on-surface">{q.site || 'Encounter'}</p>
                  <p className="text-[13px] text-on-surface-variant">
                    {q.date} · {OUTBOX_LABEL[q.status]}
                    {q.error ? ` · ${q.error}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={q.status === 'failed' ? 'saved_on_device' : q.status === 'queued' ? 'saved_on_device' : 'uploading'} />
                  {q.status === 'failed' && (
                    <>
                      <button type="button" onClick={() => void retry(q.id)} className="min-h-12 rounded-lg px-3 font-semibold text-secondary hover:bg-secondary/10">
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => window.confirm('Delete this encounter from the device? It has not been uploaded.') && void discardOutbox(q.id)}
                        className="min-h-12 rounded-lg px-3 font-semibold text-error hover:bg-error/10"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {drafts.length > 0 && (
        <section aria-labelledby="device-drafts" className={cardCls}>
          <h2 id="device-drafts" className="mb-3 flex items-center gap-2 font-headline-sm text-[18px] font-semibold text-primary">
            <Icon name="edit_document" className="text-secondary" />
            Drafts on this device
          </h2>
          <ul className="divide-y divide-outline-variant">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-on-surface">{d.header.site || 'No site yet'}</p>
                  <p className="text-[13px] text-on-surface-variant">
                    {d.header.encounterDate} · edited {timeFmt.format(d.updatedAt)}
                    {d.segments.length ? ` · ${d.segments.length} recording part(s)` : ''}
                    {d.attachments.length ? ` · ${d.attachments.length} file(s)` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => resume(d)} className="min-h-12 rounded-lg px-4 font-semibold text-secondary hover:bg-secondary/10">
                    Resume
                  </button>
                  <button type="button" onClick={() => discardDraft(d)} className="min-h-12 rounded-lg px-4 font-semibold text-error hover:bg-error/10" aria-label={`Delete draft for ${d.header.site || 'untitled'}`}>
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
