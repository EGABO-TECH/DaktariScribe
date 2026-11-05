/** Renders an ExportDoc to PDF, Word or slides. Server only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { registerReportFonts, ReportPdf } from '@/components/exports/ReportPdf';
import type { ExportDoc } from './model';

export type ExportFormat = 'pdf' | 'docx' | 'pptx';

export const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

let logoCache: Buffer | null | undefined;
async function logo(): Promise<Buffer | null> {
  if (logoCache !== undefined) return logoCache;
  logoCache = await fs.readFile(path.join(process.cwd(), 'public', 'assets', 'report-mark.png')).catch(() => null);
  return logoCache;
}

export async function renderExport(doc: ExportDoc, format: ExportFormat): Promise<Buffer> {
  if (format === 'docx') {
    const { renderDocx } = await import('./docx');
    return renderDocx(doc);
  }
  if (format === 'pptx') {
    const { renderPptx } = await import('./pptx');
    return renderPptx(doc, await logo());
  }
  registerReportFonts(path.join(process.cwd(), 'public', 'fonts'));
  const l = await logo();
  return renderToBuffer(React.createElement(ReportPdf, { doc, logoSrc: l ?? undefined, fontsRegistered: true }) as Parameters<typeof renderToBuffer>[0]);
}

export function exportFilename(doc: ExportDoc, format: ExportFormat): string {
  const base = doc.aggregate ? `DaktariScribe-report-${doc.exportedAt.toISOString().slice(0, 10)}` : (doc.records[0]?.id ?? 'record').replace(/[^A-Za-z0-9-]/g, '');
  return `${base}${doc.lang !== 'eng' ? `-${doc.lang}` : ''}.${format}`;
}
