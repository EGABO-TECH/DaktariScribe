/**
 * Single-record PDF in English. Thin adapter over ReportPdf, used by the offline PDF and tests.
 */
import React from 'react';
import type { RecordDetail } from '@/lib/records/service';
import { toExportRecord, type ExportDoc } from '@/lib/exports/model';
import { labelsFor } from '@/lib/i18n/labels';
import { ReportPdf } from './ReportPdf';

export const CONFIDENTIALITY_NOTICE = labelsFor('eng').t('confidentiality');

export type RecordPdfProps = {
  record: RecordDetail;
  orgName: string;
  logoSrc?: Buffer | string;
  exportedAt?: Date;
  watermark?: boolean;
  fontsRegistered?: boolean;
};

export function recordDoc(record: RecordDetail, orgName: string, opts: { exportedAt?: Date; watermark?: boolean } = {}): ExportDoc {
  return {
    lang: 'eng',
    labels: labelsFor('eng'),
    orgName,
    exportedAt: opts.exportedAt ?? new Date(),
    watermark: Boolean(opts.watermark),
    aggregate: false,
    records: [toExportRecord(record, 'eng')],
  };
}

export function RecordPdf({ record, orgName, logoSrc, exportedAt, watermark, fontsRegistered }: RecordPdfProps) {
  return <ReportPdf doc={recordDoc(record, orgName, { exportedAt, watermark })} logoSrc={logoSrc} fontsRegistered={fontsRegistered} />;
}
