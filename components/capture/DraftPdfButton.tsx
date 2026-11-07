'use client';

/**
 * Offline draft PDF (spec §5 Phase 4.6): rendered in the browser with the same ReportPdf
 * component as the server, from the typed note on this device. Marked as not signed off.
 */
import React, { useState } from 'react';
import type { Draft } from '@/lib/offline/db';
import { GLOBAL_TEMPLATES } from '@/lib/templates/global-templates';
import { recordFromTypedText } from '@/lib/records/refined-record';
import { toExportRecord } from '@/lib/exports/model';
import { labelsFor } from '@/lib/i18n/labels';
import type { RecordDetail } from '@/lib/records/service';
import { saveBlob } from '@/lib/download';

export default function DraftPdfButton({ draft, templateName }: { draft: Draft; templateName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tpl = GLOBAL_TEMPLATES.find((t) => t.id === draft.header.templateId) ?? GLOBAL_TEMPLATES[0];
  if (!draft.text.trim()) return null;

  const make = async () => {
    setBusy(true);
    setError('');
    try {
      const [{ pdf }, { ReportPdf, registerReportFonts }] = await Promise.all([import('@react-pdf/renderer'), import('@/components/exports/ReportPdf')]);
      registerReportFonts('/fonts');
      const content = recordFromTypedText('draft', draft.text, tpl.definition);
      const detail: RecordDetail = {
        id: 'DRAFT — not yet processed',
        orgId: '',
        workerId: '',
        workerName: 'Draft on this device',
        site: draft.header.site || '—',
        encounterDate: draft.header.encounterDate,
        respondentRef: draft.header.respondentRef || null,
        consentObtained: draft.header.consentObtained,
        interviewLanguage: draft.header.interviewLanguage,
        status: 'draft',
        createdAt: new Date(draft.createdAt),
        template: { id: tpl.id, name: templateName || tpl.name, version: tpl.version, definition: tpl.definition },
        sources: [],
        currentVersion: { id: 'draft', versionNo: 0, createdBy: '', createdAt: new Date(), content, verification: null },
        versions: [],
        signoff: null,
      };
      const doc = { lang: 'eng', labels: labelsFor('eng'), orgName: 'Draft', exportedAt: new Date(), watermark: false, aggregate: false, records: [toExportRecord(detail, 'eng')] };
      const blob = await pdf(<ReportPdf doc={doc} logoSrc="/assets/report-mark.png" fontsRegistered draft />).toBlob();
      saveBlob(blob, `draft-${draft.header.encounterDate}.pdf`);
    } catch {
      setError('The draft PDF could not be made on this device.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" onClick={make} disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-lg px-4 font-semibold text-secondary hover:bg-secondary/10 disabled:opacity-60">
        <span className={`material-symbols-outlined ${busy ? 'animate-spin' : ''}`} aria-hidden="true">
          {busy ? 'progress_activity' : 'picture_as_pdf'}
        </span>
        {busy ? 'Preparing…' : 'Draft PDF'}
      </button>
      {error && (
        <span role="alert" className="text-[12px] font-medium text-error">
          {error}
        </span>
      )}
    </span>
  );
}
