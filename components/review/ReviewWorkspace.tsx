'use client';

/**
 * Review screen (spec §5 Phase 2.4, §3d): the original on the left, the organised record on the
 * right. Selecting a line highlights the exact source text it came from (and plays that part of
 * the recording). Changes are shown as a word diff. Each line can be accepted, edited or
 * rejected. Flags are listed at the top; sign-off stays disabled while blocking flags remain.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Flag, RefinedLine, RefinedRecord, SourceSpan } from '@/lib/records/refined-record';
import { NOTES_SECTION_KEY, countBlockingFlags } from '@/lib/records/refined-record';
import type { TemplateDefinition } from '@/lib/templates/definition';
import { labelFor } from '@/lib/templates/definition';
import { wordDiff } from '@/lib/text/diff';
import { formatFieldValue } from '@/lib/records/format';

export type ReviewSource = {
  id: string;
  kind: string;
  rawText: string | null;
  status: string;
  error: string | null;
  segments: { start: number; end: number; text: string; speaker?: string; file: number; fileOffset?: number; charStart?: number; charEnd?: number; lowConfidence?: string[] }[] | null;
  fileName?: string | null;
};

type Sel = { kind: 'line'; section: string; index: number } | { kind: 'field'; key: string } | null;

const FLAG_LABEL: Record<Flag['kind'], string> = {
  not_in_source: 'Not found in original',
  possible_conflict: 'Possible conflict',
  unclear_audio: 'Unclear audio',
  illegible: 'Illegible',
  unknown_abbreviation: 'Unknown abbreviation',
};

function FlagChip({ f }: { f: Flag }) {
  const blocking = f.blocking && !f.resolved;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold ${
        f.resolved ? 'border-outline-variant text-on-surface-variant line-through' : blocking ? 'border-flag bg-flag-container text-on-flag-container' : 'border-outline text-on-surface'
      }`}
      title={f.note}
    >
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        {blocking ? 'error' : 'flag'}
      </span>
      {FLAG_LABEL[f.kind]}
      {blocking ? <span className="sr-only"> (must be resolved before sign-off)</span> : null}
    </span>
  );
}

function spannedText(spans: SourceSpan[], sources: ReviewSource[]) {
  return spans.map((s) => sources.find((x) => x.id === s.sourceId)?.rawText?.slice(s.start, s.end) ?? '').join(' ');
}

function Diff({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => wordDiff(before, after), [before, after]);
  return (
    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-on-surface-variant">
      <span className="sr-only">Changes from the original: </span>
      {parts.map((p, i) =>
        p.kind === 'same' ? (
          <span key={i}>{p.text}</span>
        ) : p.kind === 'added' ? (
          <ins key={i} className="rounded bg-success-container px-0.5 text-on-success-container no-underline">
            <span className="sr-only">added: </span>
            {p.text}
          </ins>
        ) : (
          <del key={i} className="rounded bg-error-container px-0.5 text-on-error-container">
            <span className="sr-only">removed: </span>
            {p.text}
          </del>
        ),
      )}
    </p>
  );
}

export default function ReviewWorkspace({
  recordId,
  versionId,
  content: initial,
  definition,
  sources,
  editable,
  organised,
  localLanguage,
}: {
  recordId: string;
  versionId: string;
  content: RefinedRecord;
  definition: TemplateDefinition;
  sources: ReviewSource[];
  editable: boolean;
  organised: boolean;
  /** True for interviews not in English: offers an English translation column. */
  localLanguage?: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState<RefinedRecord>(initial);
  const [dirty, setDirty] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string> | null>(null);
  const [translating, setTranslating] = useState(false);

  const toggleTranslation = async () => {
    if (showTranslation) return setShowTranslation(false);
    setShowTranslation(true);
    if (translations) return;
    setTranslating(true);
    const out: Record<string, string> = {};
    for (const s of sources.filter((x) => x.rawText)) {
      try {
        const res = await fetch(`/api/sources/${s.id}/translate`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        out[s.id] = res.ok ? data.text : data.error ?? 'Translation is not available.';
      } catch {
        out[s.id] = 'Translation is not available offline.';
      }
    }
    setTranslations(out);
    setTranslating(false);
  };

  const blocking = countBlockingFlags(content);
  const sectionLabel = (key: string) =>
    key === NOTES_SECTION_KEY ? 'Clinical notes' : labelFor(definition.sections.find((s) => s.key === key)?.label ?? { eng: key });
  const fieldDef = (key: string) => definition.sections.flatMap((s) => s.fields).find((f) => f.key === key);

  const allIssues = useMemo(() => {
    const out: { sel: NonNullable<Sel>; label: string; flags: Flag[] }[] = [];
    content.sections.forEach((s) =>
      s.lines.forEach((l, index) => {
        const open = (l.flags ?? []).filter((f) => !f.resolved);
        if (open.length) out.push({ sel: { kind: 'line', section: s.key, index }, label: `${sectionLabel(s.key)}, line ${index + 1}`, flags: open });
      }),
    );
    content.fields.forEach((f) => {
      const open = (f.flags ?? []).filter((x) => !x.resolved);
      if (open.length) out.push({ sel: { kind: 'field', key: f.key }, label: labelFor(fieldDef(f.key)?.label ?? { eng: f.key }), flags: open });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const selectedSpans: SourceSpan[] = useMemo(() => {
    if (!sel) return [];
    if (sel.kind === 'line') return content.sections.find((s) => s.key === sel.section)?.lines[sel.index]?.spans ?? [];
    return content.fields.find((f) => f.key === sel.key)?.spans ?? [];
  }, [sel, content]);

  const mutateLine = (section: string, index: number, fn: (l: RefinedLine) => RefinedLine | null) => {
    setContent((c) => ({
      ...c,
      sections: c.sections.map((s) =>
        s.key !== section
          ? s
          : { ...s, lines: s.lines.flatMap((l, i) => (i !== index ? [l] : (() => { const r = fn(l); return r ? [r] : []; })())) },
      ),
    }));
    setDirty(true);
    setMessage(null);
  };

  const accept = (section: string, index: number) =>
    mutateLine(section, index, (l) => ({ ...l, flags: (l.flags ?? []).map((f) => ({ ...f, resolved: true })) }));
  const reject = (section: string, index: number) => {
    if (window.confirm('Remove this line from the record? The original notes are not changed.')) mutateLine(section, index, () => null);
    setSel(null);
  };
  const saveEdit = (section: string, index: number) => {
    const text = draftText.trim();
    if (!text) return;
    mutateLine(section, index, (l) => ({ ...l, text, flags: (l.flags ?? []).map((f) => ({ ...f, resolved: true })) }));
    setEditing(null);
  };
  const acceptField = (key: string) => {
    setContent((c) => ({ ...c, fields: c.fields.map((f) => (f.key === key ? { ...f, flags: (f.flags ?? []).map((x) => ({ ...x, resolved: true })) } : f)) }));
    setDirty(true);
  };
  const clearField = (key: string) => {
    setContent((c) => ({ ...c, fields: c.fields.map((f) => (f.key === key ? { key, value: null, spans: [], status: 'not_recorded' as const } : f)) }));
    setDirty(true);
  };
  const setCode = (i: number, action: 'confirm' | 'remove') => {
    setContent((c) => ({
      ...c,
      suggestedCodes: action === 'remove' ? (c.suggestedCodes ?? []).filter((_, j) => j !== i) : (c.suggestedCodes ?? []).map((x, j) => (j === i ? { ...x, confirmed: true } : x)),
    }));
    setDirty(true);
  };

  /** Plays the part of the recording behind the selected item. */
  const play = (spans: SourceSpan[]) => {
    for (const sp of spans) {
      const src = sources.find((s) => s.id === sp.sourceId && s.kind === 'audio');
      const seg = src?.segments?.find((g) => (g.charStart ?? -1) <= sp.start && (g.charEnd ?? -1) >= sp.start) ?? src?.segments?.find((g) => (g.charStart ?? 0) < sp.end && (g.charEnd ?? 0) > sp.start);
      if (src && seg && audio.current) {
        const url = `/api/sources/${src.id}/media?file=${seg.file}`;
        const at = Math.max(0, seg.start - (seg.fileOffset ?? 0));
        const el = audio.current;
        const go = () => {
          el.currentTime = at;
          void el.play();
          const stopAt = seg.end - (seg.fileOffset ?? 0);
          const onTime = () => {
            if (el.currentTime >= stopAt) {
              el.pause();
              el.removeEventListener('timeupdate', onTime);
            }
          };
          el.addEventListener('timeupdate', onTime);
        };
        if (!el.src.endsWith(url)) {
          el.src = url;
          el.addEventListener('loadedmetadata', go, { once: true });
        } else go();
        return;
      }
    }
  };

  const select = (s: NonNullable<Sel>) => {
    setSel(s);
    const id = s.kind === 'line' ? `line-${s.section}-${s.index}` : `field-${s.key}`;
    document.getElementById(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setTimeout(() => document.querySelector('[data-highlight="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/encounters/${encodeURIComponent(recordId)}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseVersionId: versionId, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ kind: 'error', text: data.error ?? 'Could not save the review.' });
        return;
      }
      setDirty(false);
      setMessage({ kind: 'ok', text: 'Review saved as a new version.' });
      router.refresh();
    } catch {
      setMessage({ kind: 'error', text: 'Connection lost. The review was not saved.' });
    } finally {
      setBusy(false);
    }
  };

  const reprocess = async () => {
    if (!window.confirm('Organise the original notes again? Unsaved review changes will be lost.')) return;
    setBusy(true);
    const res = await fetch(`/api/encounters/${encodeURIComponent(recordId)}/reprocess`, { method: 'POST' });
    setBusy(false);
    if (res.ok) router.push(`/records/${encodeURIComponent(recordId)}`);
    else setMessage({ kind: 'error', text: (await res.json().catch(() => ({}))).error ?? 'Could not re-process.' });
  };

  /** Original text with the selected span(s) highlighted. */
  const renderSource = (s: ReviewSource) => {
    const text = s.rawText ?? '';
    const hits = selectedSpans.filter((sp) => sp.sourceId === s.id).sort((a, b) => a.start - b.start);
    const low = new Set((s.segments ?? []).flatMap((g) => g.lowConfidence ?? []).map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')));
    const pieces: React.ReactNode[] = [];
    let at = 0;
    hits.forEach((h, i) => {
      if (h.start > at) pieces.push(<span key={`t${i}`}>{text.slice(at, h.start)}</span>);
      pieces.push(
        <mark key={`h${i}`} data-highlight="true" className="rounded bg-primary-fixed px-0.5 text-on-primary-fixed">
          {text.slice(h.start, h.end)}
        </mark>,
      );
      at = Math.max(at, h.end);
    });
    pieces.push(<span key="end">{text.slice(at)}</span>);
    return (
      <div key={s.id} className="rounded-lg border border-outline-variant">
        <p className="flex items-center gap-1.5 border-b border-outline-variant bg-surface-container-low px-3 py-2 text-[13px] font-semibold text-on-surface">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            {s.kind === 'audio' ? 'mic' : s.kind === 'upload' ? 'upload_file' : 'keyboard'}
          </span>
          {s.kind === 'audio' ? 'Transcript' : s.kind === 'upload' ? s.fileName ?? 'Uploaded file' : 'Typed note'}
          {s.status === 'failed' && <span className="ml-auto text-error">{s.error}</span>}
        </p>
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap p-3 text-[15px] leading-7 text-on-surface">{text ? pieces : <span className="italic text-on-surface-variant">No text</span>}</div>
        {low.size > 0 && <p className="border-t border-outline-variant px-3 py-2 text-[12px] text-on-surface-variant">Some words were hard to hear; listen to the recording where a line is flagged “Unclear audio”.</p>}
      </div>
    );
  };

  const hasLocal = Boolean(localLanguage);

  return (
    <div className="flex flex-col gap-gutter">
      <audio ref={audio} className="hidden" preload="none" />

      {/* Flags summary */}
      <section aria-labelledby="flags-h" className={`rounded-xl border p-4 ${blocking ? 'border-flag bg-flag-container text-on-flag-container' : 'border-secondary bg-success-container text-on-success-container'}`}>
        <h2 id="flags-h" className="flex items-center gap-2 font-semibold">
          <span className="material-symbols-outlined" aria-hidden="true">
            {blocking ? 'error' : 'check_circle'}
          </span>
          {blocking ? `${blocking} item(s) must be checked before sign-off` : allIssues.length ? 'No blocking items. Some items have notes.' : 'Every line points to the original notes. Nothing flagged.'}
        </h2>
        {!organised && <p className="mt-1 text-[14px]">This version is your original note, unchanged. Automated organising was not available for it.</p>}
        {allIssues.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {allIssues.map((iss, i) => (
              <li key={i}>
                <button type="button" onClick={() => select(iss.sel)} className="flex min-h-12 w-full flex-wrap items-center gap-2 rounded-lg px-2 text-left hover:bg-black/5">
                  <span className="font-semibold">{iss.label}</span>
                  {iss.flags.map((f, j) => (
                    <FlagChip key={j} f={f} />
                  ))}
                  <span className="text-[13px]">{iss.flags[0].note}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={`grid grid-cols-1 gap-gutter ${hasLocal && showTranslation ? 'xl:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {/* Original */}
        <section aria-labelledby="orig-h" className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 lg:sticky lg:top-0 lg:self-start">
          <div className="flex items-center justify-between gap-2">
            <h2 id="orig-h" className="font-headline-sm text-headline-sm text-primary">
              Original
            </h2>
            {hasLocal && (
              <button type="button" onClick={() => void toggleTranslation()} className="min-h-12 rounded-lg px-3 text-[14px] font-semibold text-secondary hover:bg-secondary/10">
                {showTranslation ? 'Hide English translation' : 'Show English translation'}
              </button>
            )}
          </div>
          {sources.map(renderSource)}
        </section>

        {hasLocal && showTranslation && (
          <section aria-labelledby="tr-h" className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <h2 id="tr-h" className="font-headline-sm text-headline-sm text-primary">
              English translation
            </h2>
            <p className="text-[13px] text-on-surface-variant">Automatically translated, for reference while reviewing. Not part of the record.</p>
            {translating && <p className="text-body-md text-on-surface-variant">Translating…</p>}
            {Object.entries(translations ?? {}).map(([id, t]) => (
              <div key={id} className="whitespace-pre-wrap rounded-lg border border-outline-variant p-3 text-[15px] leading-7 text-on-surface">
                {t}
              </div>
            ))}
          </section>
        )}

        {/* Organised record */}
        <section aria-labelledby="rec-h" className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <h2 id="rec-h" className="font-headline-sm text-headline-sm text-primary">
            {organised ? 'Organised draft' : 'Draft'}
          </h2>
          {content.sections.map((sec) => (
            <div key={sec.key}>
              <h3 className="mb-2 border-l-4 border-secondary bg-surface-container-low px-3 py-1.5 font-semibold text-primary">{sectionLabel(sec.key)}</h3>
              <ol className="flex flex-col gap-2">
                {sec.lines.map((l, i) => {
                  const key = `${sec.key}-${i}`;
                  const isSel = sel?.kind === 'line' && sel.section === sec.key && sel.index === i;
                  const src = spannedText(l.spans, sources);
                  const blockingHere = (l.flags ?? []).some((f) => f.blocking && !f.resolved);
                  return (
                    <li
                      key={key}
                      id={`line-${key}`}
                      className={`rounded-lg border p-3 ${isSel ? 'border-primary ring-2 ring-primary/30' : blockingHere ? 'border-flag' : 'border-outline-variant'}`}
                    >
                      {editing === key ? (
                        <div className="flex flex-col gap-2">
                          <label className="sr-only" htmlFor={`edit-${key}`}>
                            Edit line
                          </label>
                          <textarea id={`edit-${key}`} value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={3} className="w-full rounded-lg border border-outline p-2 text-[16px] text-on-surface" />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => saveEdit(sec.key, i)} className="min-h-12 rounded-lg bg-primary px-4 font-semibold text-on-primary">
                              Use this wording
                            </button>
                            <button type="button" onClick={() => setEditing(null)} className="min-h-12 rounded-lg px-4 font-semibold text-on-surface hover:bg-surface-container-high">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button type="button" onClick={() => { select({ kind: 'line', section: sec.key, index: i }); play(l.spans); }} className="w-full text-left text-[16px] leading-7 text-on-surface">
                            {l.text}
                          </button>
                          {organised && src && src.trim() !== l.text.trim() && <Diff before={src} after={l.text} />}
                          {!src && <p className="mt-1 text-[13px] font-semibold text-on-flag-container">Does not point to the original notes.</p>}
                          {(l.flags?.length ?? 0) > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {l.flags!.map((f, j) => (
                                <FlagChip key={j} f={f} />
                              ))}
                            </div>
                          )}
                          {(l.flags ?? []).some((f) => !f.resolved) && <p className="mt-1 text-[13px] text-on-surface-variant">{l.flags!.find((f) => !f.resolved)!.note}</p>}
                          {editable && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(l.flags ?? []).some((f) => !f.resolved) && (
                                <button type="button" onClick={() => accept(sec.key, i)} className="min-h-12 rounded-lg border border-secondary px-3 font-semibold text-secondary hover:bg-secondary/10">
                                  Accept
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(key);
                                  setDraftText(l.text);
                                }}
                                className="min-h-12 rounded-lg border border-outline px-3 font-semibold text-on-surface hover:bg-surface-container-high"
                              >
                                Edit
                              </button>
                              <button type="button" onClick={() => reject(sec.key, i)} className="min-h-12 rounded-lg px-3 font-semibold text-error hover:bg-error/10">
                                Reject
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}

          {/* Fields */}
          {definition.sections.some((s) => s.fields.length) && (
            <div>
              <h3 className="mb-2 border-l-4 border-secondary bg-surface-container-low px-3 py-1.5 font-semibold text-primary">Recorded values</h3>
              <dl className="divide-y divide-outline-variant rounded-lg border border-outline-variant">
                {definition.sections.flatMap((s) => s.fields).map((fd) => {
                  const f = content.fields.find((x) => x.key === fd.key);
                  const recorded = f && f.status === 'recorded' && f.value !== null;
                  const open = (f?.flags ?? []).filter((x) => !x.resolved);
                  const isSel = sel?.kind === 'field' && sel.key === fd.key;
                  return (
                    <div key={fd.key} id={`field-${fd.key}`} className={`grid grid-cols-1 gap-1 px-3 py-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center ${isSel ? 'bg-primary-fixed/40' : ''}`}>
                      <dt className="text-body-md text-on-surface-variant">{labelFor(fd.label)}</dt>
                      <dd>
                        <button
                          type="button"
                          onClick={() => f && (select({ kind: 'field', key: fd.key }), play(f.spans))}
                          className={recorded ? 'text-left text-body-md font-semibold text-on-surface' : 'text-left text-body-md italic text-on-surface-variant'}
                        >
                          {recorded ? formatFieldValue(fd, f!.value) : 'Not recorded'}
                        </button>
                        {open.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {open.map((x, j) => (
                              <FlagChip key={j} f={x} />
                            ))}
                          </div>
                        )}
                      </dd>
                      {editable && recorded && (
                        <div className="flex gap-1">
                          {open.length > 0 && (
                            <button type="button" onClick={() => acceptField(fd.key)} className="min-h-12 rounded-lg px-3 font-semibold text-secondary hover:bg-secondary/10">
                              Accept
                            </button>
                          )}
                          <button type="button" onClick={() => clearField(fd.key)} className="min-h-12 rounded-lg px-3 font-semibold text-error hover:bg-error/10">
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </dl>
            </div>
          )}

          {/* Suggested codes */}
          {(content.suggestedCodes?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 border-l-4 border-secondary bg-surface-container-low px-3 py-1.5 font-semibold text-primary">Suggested codes — confirm</h3>
              <ul className="flex flex-col gap-2">
                {content.suggestedCodes!.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant p-2">
                    <span className="text-body-md text-on-surface">
                      <strong>{c.code}</strong> {c.label} <span className="text-on-surface-variant">({c.system})</span>
                      {c.confirmed ? <span className="ml-2 font-semibold text-secondary">Confirmed</span> : null}
                    </span>
                    {editable && !c.confirmed && (
                      <span className="flex gap-1">
                        <button type="button" onClick={() => setCode(i, 'confirm')} className="min-h-12 rounded-lg px-3 font-semibold text-secondary hover:bg-secondary/10">
                          Confirm
                        </button>
                        <button type="button" onClick={() => setCode(i, 'remove')} className="min-h-12 rounded-lg px-3 font-semibold text-error hover:bg-error/10">
                          Remove
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {editable && (
        <div className="sticky bottom-16 z-30 flex flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 lg:bottom-0">
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`w-full text-[14px] font-semibold ${message.kind === 'error' ? 'text-error' : 'text-secondary'}`}>
              {message.text}
            </p>
          )}
          <button type="button" onClick={save} disabled={!dirty || busy} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-60">
            <span className="material-symbols-outlined" aria-hidden="true">
              save
            </span>
            {busy ? 'Saving…' : 'Save review'}
          </button>
          <a
            href={`/records/${encodeURIComponent(recordId)}#signoff-h`}
            aria-disabled={dirty || blocking > 0}
            onClick={(e) => (dirty || blocking > 0) && e.preventDefault()}
            className={`inline-flex min-h-12 items-center gap-2 rounded-lg px-5 font-semibold ${dirty || blocking > 0 ? 'cursor-not-allowed bg-surface-container-high text-on-surface-variant' : 'bg-secondary text-on-secondary hover:bg-secondary/90'}`}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              verified
            </span>
            Go to sign-off
          </a>
          <button type="button" onClick={reprocess} disabled={busy} className="ml-auto inline-flex min-h-12 items-center gap-2 rounded-lg px-4 font-semibold text-on-surface hover:bg-surface-container-high">
            <span className="material-symbols-outlined" aria-hidden="true">
              refresh
            </span>
            Re-process
          </button>
          {(dirty || blocking > 0) && (
            <p className="w-full text-[13px] text-on-surface-variant">{dirty ? 'Save your review before signing off.' : 'Resolve the flagged items before signing off.'}</p>
          )}
        </div>
      )}
    </div>
  );
}
