import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { RecordPdf } from '@/components/exports/RecordPdf';
import { recordFromTypedText } from '@/lib/records/refined-record';
import { GLOBAL_TEMPLATES } from '@/lib/templates/global-templates';
import type { RecordDetail } from '@/lib/records/service';

const tpl = GLOBAL_TEMPLATES[0];
const raw = 'Fever for 3 days.\n\nRDT positive.';
const content = recordFromTypedText('src1', raw, tpl.definition);
content.fields = content.fields.map((f) => (f.key === 'temperature_c' ? { ...f, value: 38.5, status: 'recorded' as const } : f));

const record: RecordDetail = {
  id: 'DS-2026-01-08-K7QH3MZD-9TRA',
  orgId: 'org',
  workerId: 'user_1',
  workerName: 'Test Worker',
  site: 'Test HC III',
  encounterDate: '2026-08-01',
  respondentRef: 'R-001',
  consentObtained: true,
  interviewLanguage: 'eng',
  status: 'final',
  createdAt: new Date('2026-08-01T09:00:00Z'),
  template: { id: tpl.id, name: tpl.name, version: tpl.version, definition: tpl.definition },
  sources: [{ id: 'src1', kind: 'text', engine: 'typed', rawText: raw, createdAt: new Date() }],
  currentVersion: { id: 'v1', versionNo: 1, createdBy: 'user_1', createdAt: new Date(), content },
  versions: [{ id: 'v1', versionNo: 1, createdBy: 'user_1', createdAt: new Date() }],
  signoff: { signerId: 'user_1', signerName: 'Test Worker', signedAt: new Date('2026-08-01T10:00:00Z'), statement: 'I confirm.' },
};

describe('RecordPdf', () => {
  it('renders a valid PDF document', async () => {
    const buf = await renderToBuffer(<RecordPdf record={record} orgName="Test Org" />);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2000);
    // Set PDF_OUT=/path/file.pdf to inspect the rendered report visually.
    if (process.env.PDF_OUT) fs.writeFileSync(process.env.PDF_OUT, buf);
  }, 30_000);
});
