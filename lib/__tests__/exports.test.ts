import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { renderExport } from '@/lib/exports/render';
import { toExportRecord, type ExportDoc } from '@/lib/exports/model';
import { labelsFor } from '@/lib/i18n/labels';
import { recordFromTypedText } from '@/lib/records/refined-record';
import { GLOBAL_TEMPLATES } from '@/lib/templates/global-templates';
import { protect, unprotect, TranslationIntegrityError } from '@/lib/translate/placeholders';
import type { RecordDetail } from '@/lib/records/service';

const tpl = GLOBAL_TEMPLATES[0];
const raw = 'Omulwadde alina omusujja 38.5 C okumala ennaku 3.\n\nBP 120/80. Yaweereddwa paracetamol 1g.';
const content = recordFromTypedText('s1', raw, tpl.definition);
content.fields = content.fields.map((f) =>
  f.key === 'temperature_c' ? { ...f, value: 38.5, status: 'recorded' as const } : f.key === 'malaria_rdt' ? { ...f, value: 'Positive', status: 'recorded' as const } : f,
);
const rec: RecordDetail = {
  id: 'DS-2026-01-08-K7QH3MZD-9TRA',
  orgId: 'o',
  workerId: 'u',
  workerName: 'Test Worker',
  site: 'Kiryandongo HC III',
  encounterDate: '2026-08-01',
  respondentRef: 'R-1',
  consentObtained: true,
  interviewLanguage: 'lug',
  status: 'final',
  createdAt: new Date(),
  template: { id: tpl.id, name: tpl.name, version: 1, definition: tpl.definition },
  sources: [{ id: 's1', kind: 'text', engine: 'typed', rawText: raw, createdAt: new Date(), status: 'ready', error: null, mimeType: 'text/plain', fileCount: 0, durationSec: null, segments: null, meta: null }],
  currentVersion: { id: 'v1', versionNo: 1, createdBy: 'u', createdAt: new Date(), content, verification: null },
  versions: [],
  signoff: { signerId: 'u', signerName: 'Test Worker', signedAt: new Date('2026-08-01T10:00:00Z'), statement: 'I confirm.' },
};

function doc(lang: string, aggregate = false): ExportDoc {
  return {
    lang,
    labels: labelsFor(lang),
    orgName: 'Test Org',
    exportedAt: new Date(),
    watermark: true,
    aggregate,
    records: [toExportRecord(rec, lang, null, { includeOriginals: true })],
    metrics: aggregate ? [{ fieldKey: 'temperature_c', label: 'Temperature — Average by site', kind: 'numeric', unit: '°C', points: [{ label: 'Kiryandongo HC III', value: 38.5 }] }] : undefined,
    summary: aggregate ? { records: 1, sites: ['Kiryandongo HC III'], workers: 1, from: '2026-08-01', to: '2026-08-01' } : undefined,
    followUps: [],
  };
}

describe('exports', () => {
  it('renders PDF, Word and slides', async () => {
    const pdf = await renderExport(doc('eng'), 'pdf');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const docx = await renderExport(doc('fra', true), 'docx');
    expect(docx.subarray(0, 2).toString()).toBe('PK');
    const pptx = await renderExport(doc('eng', true), 'pptx');
    expect(pptx.subarray(0, 2).toString()).toBe('PK');
    if (process.env.EXPORT_OUT) {
      fs.writeFileSync(`${process.env.EXPORT_OUT}/sample.pdf`, pdf);
      fs.writeFileSync(`${process.env.EXPORT_OUT}/aggregate.pdf`, await renderExport(doc('swa', true), 'pdf'));
      fs.writeFileSync(`${process.env.EXPORT_OUT}/sample.docx`, docx);
      fs.writeFileSync(`${process.env.EXPORT_OUT}/sample.pptx`, pptx);
    }
  }, 60_000);

  it('uses human catalogues for labels and English fallback for untranslated ones', () => {
    expect(labelsFor('fra').t('notRecorded')).toBe('Non renseigné');
    expect(labelsFor('lug').t('notRecorded')).toBe('Not recorded');
    expect(labelsFor('xyz').lang).toBe('eng');
  });
});

describe('translation placeholder protection', () => {
  it('protects numbers, units, dates, doses, drugs and IDs, and restores them', () => {
    const src = 'Temp 38.5 °C on 01/08/2026, BP 120/80. Give paracetamol 1g TDS x 3 days. Ref DS-2026-01-08-K7QH3MZD-9TRA and ⟦PERSON_1⟧.';
    const { text, map } = protect(src);
    for (const v of ['38.5', '01/08/2026', '120/80', 'paracetamol', '1g', 'DS-2026', '⟦PERSON_1⟧']) expect(text).not.toContain(v);
    expect(unprotect(text, map)).toBe(src);
  });
  it('fails when a protected value is dropped or altered', () => {
    const { text, map } = protect('Temp 38.5 C, gave amoxicillin.');
    expect(() => unprotect(text.replace('⟦N1⟧', '39'), map)).toThrow(TranslationIntegrityError);
    expect(() => unprotect(`${text} ⟦N1⟧`, map)).toThrow(TranslationIntegrityError);
  });
});
