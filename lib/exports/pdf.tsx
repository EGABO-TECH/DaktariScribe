import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { RecordPdf } from '@/components/exports/RecordPdf';
import type { RecordDetail } from '@/lib/records/service';

let logoCache: Buffer | null = null;

async function loadLogo(): Promise<Buffer | undefined> {
  if (logoCache) return logoCache;
  try {
    logoCache = await fs.readFile(path.join(process.cwd(), 'public', 'assets', 'report-mark.png'));
    return logoCache;
  } catch {
    return undefined; // the report still renders without the mark
  }
}

export async function renderRecordPdf(record: RecordDetail, orgName: string): Promise<Buffer> {
  const logoSrc = await loadLogo();
  return renderToBuffer(<RecordPdf record={record} orgName={orgName} logoSrc={logoSrc} />);
}

/** Safe ASCII filename for Content-Disposition. */
export function pdfFilename(recordId: string): string {
  return `${recordId.replace(/[^A-Za-z0-9-]/g, '')}.pdf`;
}
