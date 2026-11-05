/**
 * Language-neutral export model shared by the PDF, Word and slide renderers, so all three show
 * identical facts and numbers (spec Gate 5). Pure: no I/O.
 */
import { labelFor } from '@/lib/templates/definition';
import { NOTES_SECTION_KEY } from '@/lib/records/refined-record';
import { formatFieldValue } from '@/lib/records/format';
import { languageName } from '@/lib/records/languages';
import type { RecordDetail } from '@/lib/records/service';
import { formatDate, labelsFor, type Labels } from '@/lib/i18n/labels';

export type ExportField = { key: string; label: string; value: string | null; metric: boolean };
export type ExportSection = { key: string; label: string; lines: string[]; fields: ExportField[] };

export type ExportRecord = {
  id: string;
  encounterDate: string;
  site: string;
  workerName: string;
  templateName: string;
  templateVersion: number;
  interviewLanguage: string;
  respondentRef: string | null;
  consentObtained: boolean;
  versionNo: number | null;
  sections: ExportSection[];
  codes: string[];
  signoff: { name: string; at: Date; statement: string } | null;
  /** Original notes, for the optional appendix. */
  originals?: { label: string; text: string }[];
  translationNote?: string | null;
};

export type MetricSeries = { fieldKey: string; label: string; kind: 'numeric' | 'categorical'; unit?: string; points: { label: string; value: number }[] };

export type ExportDoc = {
  lang: string;
  labels: Labels;
  orgName: string;
  exportedAt: Date;
  watermark: boolean;
  aggregate: boolean;
  records: ExportRecord[];
  /** Aggregate only: computed in SQL from confirmed metric fields. */
  metrics?: MetricSeries[];
  summary?: { records: number; sites: string[]; workers: number; from: string | null; to: string | null };
  followUps?: { recordId: string; site: string; label: string; date: string }[];
};

/** Translated text by stable key: "line:<section>:<i>", "field:<key>", "label:<…>". */
export type TranslatedText = Record<string, string>;

export function toExportRecord(r: RecordDetail, lang: string, translated?: TranslatedText | null, opts: { includeOriginals?: boolean } = {}): ExportRecord {
  const L = labelsFor(lang);
  const content = r.currentVersion?.content;
  const lines = new Map((content?.sections ?? []).map((s) => [s.key, s.lines]));
  const values = new Map((content?.fields ?? []).map((f) => [f.key, f]));
  const tr = (key: string, original: string) => translated?.[key] ?? original;

  const sections: ExportSection[] = [];
  const notes = lines.get(NOTES_SECTION_KEY) ?? [];
  sections.push({ key: NOTES_SECTION_KEY, label: L.t('clinicalNotes'), lines: notes.map((l, i) => tr(`line:${NOTES_SECTION_KEY}:${i}`, l.text)), fields: [] });
  for (const sec of r.template.definition.sections) {
    const secLines = lines.get(sec.key) ?? [];
    if (!sec.fields.length && !secLines.length) continue;
    sections.push({
      key: sec.key,
      label: labelFor(sec.label, lang),
      lines: secLines.map((l, i) => tr(`line:${sec.key}:${i}`, l.text)),
      fields: sec.fields.map((f) => {
        const v = values.get(f.key);
        const recorded = v && v.status === 'recorded' && v.value !== null && v.value !== '';
        let value: string | null = null;
        if (recorded) {
          if (f.type === 'boolean') value = v!.value === true ? L.t('yes') : L.t('no');
          else if (f.type === 'text' || f.type === 'choice') value = tr(`field:${f.key}`, formatFieldValue(f, v!.value));
          else value = formatFieldValue(f, v!.value);
        }
        return { key: f.key, label: labelFor(f.label, lang), value, metric: Boolean(f.metric) };
      }),
    });
  }
  // Drop an empty notes section when the template's own sections carry the content.
  if (!notes.length && sections.length > 1) sections.shift();

  return {
    id: r.id,
    encounterDate: r.encounterDate,
    site: r.site,
    workerName: r.workerName,
    templateName: r.template.name,
    templateVersion: r.template.version,
    interviewLanguage: languageName(r.interviewLanguage),
    respondentRef: r.respondentRef,
    consentObtained: r.consentObtained,
    versionNo: r.currentVersion?.versionNo ?? null,
    sections,
    codes: (content?.suggestedCodes ?? []).filter((c) => c.confirmed).map((c) => `${c.code} ${c.label} (${c.system})`),
    signoff: r.signoff ? { name: r.signoff.signerName, at: r.signoff.signedAt, statement: r.signoff.statement } : null,
    originals: opts.includeOriginals ? r.sources.filter((s) => s.rawText).map((s) => ({ label: s.kind === 'audio' ? 'Transcript' : s.kind === 'upload' ? 'Uploaded file' : 'Typed note', text: s.rawText! })) : undefined,
  };
}

export function provenance(rec: ExportRecord, L: Labels): string {
  return L.t('provenance', { worker: rec.workerName, date: formatDate(rec.encounterDate, L.lang) });
}
