/**
 * Word export (spec §5 Phase 5.1): same structure as the PDF, with real Word headings and
 * tables so the document stays editable. Embeds Noto Sans. Server only.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ExportDoc, ExportRecord } from './model';
import { provenance } from './model';
import { formatDate } from '@/lib/i18n/labels';

const FONT = 'Noto Sans';
const NAVY = '001D3D';
const MUTED = '43474F';
const RULE = 'C3C6D0';

const border = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text: string, opts: { bold?: boolean; muted?: boolean; italic?: boolean; width?: number; shade?: boolean } = {}) {
  return new TableCell({
    borders,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shade ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F0F4F7' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, italics: opts.italic, color: opts.muted ? MUTED : undefined })] })],
  });
}

function recordChildren(rec: ExportRecord, doc: ExportDoc): (Paragraph | Table)[] {
  const L = doc.labels;
  const out: (Paragraph | Table)[] = [];
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${L.t('reportTitle')} — ${rec.id}`)] }));
  if (rec.translationNote) out.push(new Paragraph({ children: [new TextRun({ text: rec.translationNote, italics: true, color: '78350F' })] }));
  const meta: [string, string][] = [
    [L.t('recordId'), rec.id],
    [L.t('encounterDate'), formatDate(rec.encounterDate, doc.lang)],
    [L.t('site'), rec.site],
    [L.t('author'), rec.workerName],
    [L.t('template'), `${rec.templateName} (v${rec.templateVersion})`],
    [L.t('interviewLanguage'), rec.interviewLanguage],
    [L.t('respondentRef'), rec.respondentRef || L.t('notRecorded')],
    [L.t('consentObtained'), rec.consentObtained ? L.t('yes') : L.t('no')],
    [L.t('version'), rec.versionNo ? `v${rec.versionNo}` : '—'],
  ];
  out.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: meta.map(([k, v]) => new TableRow({ children: [cell(k, { muted: true, width: 40, shade: true }), cell(v, { bold: true, width: 60 })] })),
    }),
  );
  for (const sec of rec.sections) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(sec.label)] }));
    for (const l of sec.lines) out.push(new Paragraph({ children: [new TextRun(l)], spacing: { after: 80 } }));
    if (!sec.lines.length && !sec.fields.length) out.push(new Paragraph({ children: [new TextRun({ text: L.t('notRecorded'), italics: true, color: MUTED })] }));
    if (sec.fields.length) {
      out.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: sec.fields.map(
            (f) =>
              new TableRow({
                children: [cell(f.label, { muted: true, width: 45 }), f.value !== null ? cell(f.value, { bold: true, width: 55 }) : cell(L.t('notRecorded'), { italic: true, muted: true, width: 55 })],
              }),
          ),
        }),
      );
    }
  }
  if (rec.codes.length) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(L.t('suggestedCodes'))] }));
    for (const c of rec.codes) out.push(new Paragraph({ children: [new TextRun(c)] }));
  }
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(L.t('signoffTitle'))] }));
  if (rec.signoff) {
    out.push(new Paragraph({ children: [new TextRun(rec.signoff.statement)] }));
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${L.t('signedOffBy')}: `, color: MUTED }),
          new TextRun({ text: rec.signoff.name, bold: true }),
          new TextRun({ text: `   ${L.t('dateTime')}: `, color: MUTED }),
          new TextRun({ text: formatDate(rec.signoff.at, doc.lang, true), bold: true }),
        ],
      }),
    );
  } else out.push(new Paragraph({ children: [new TextRun({ text: L.t('notSignedOff'), italics: true })] }));
  out.push(new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: `${L.t('signature')}: ______________________    ${L.t('stamp')}: ______________________`, color: MUTED })] }));
  out.push(
    new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({ text: `${provenance(rec, L)} ${L.t('exported', { date: formatDate(doc.exportedAt, doc.lang, true) })}`, size: 17, color: MUTED })],
    }),
  );
  if (rec.originals?.length) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true, children: [new TextRun(L.t('appendixTranscript'))] }));
    for (const o of rec.originals) {
      out.push(new Paragraph({ children: [new TextRun({ text: o.label, bold: true })] }));
      for (const line of o.text.split('\n')) out.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }
  return out;
}

function summaryChildren(doc: ExportDoc): (Paragraph | Table)[] {
  const L = doc.labels;
  const s = doc.summary!;
  const out: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(L.t('aggregateTitle'))] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [cell(L.t('records'), { muted: true, shade: true }), cell(String(s.records), { bold: true })] }),
        new TableRow({ children: [cell(L.t('sites'), { muted: true, shade: true }), cell(s.sites.join(', '), { bold: true })] }),
        new TableRow({ children: [cell(L.t('workers'), { muted: true, shade: true }), cell(String(s.workers), { bold: true })] }),
        new TableRow({
          children: [cell(L.t('period'), { muted: true, shade: true }), cell(`${s.from ? formatDate(s.from, doc.lang) : '—'} – ${s.to ? formatDate(s.to, doc.lang) : '—'}`, { bold: true })],
        }),
      ],
    }),
  ];
  for (const m of doc.metrics ?? []) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(m.label)] }));
    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: m.points.map((p) => new TableRow({ children: [cell(p.label, { muted: true, width: 60 }), cell(`${p.value}${m.unit ? ` ${m.unit}` : ''}`, { bold: true, width: 40 })] })),
      }),
    );
  }
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(L.t('followUpsDue'))] }));
  if (doc.followUps?.length) for (const f of doc.followUps) out.push(new Paragraph({ children: [new TextRun(`${formatDate(f.date, doc.lang)} · ${f.label} · ${f.site} · ${f.recordId}`)] }));
  else out.push(new Paragraph({ children: [new TextRun({ text: L.t('noFollowUps'), italics: true })] }));
  return out;
}

export async function renderDocx(doc: ExportDoc): Promise<Buffer> {
  const dir = path.join(process.cwd(), 'public', 'fonts');
  const [regular, bold, italic, logo] = await Promise.all([
    fs.readFile(path.join(dir, 'NotoSans-Regular.ttf')),
    fs.readFile(path.join(dir, 'NotoSans-Bold.ttf')),
    fs.readFile(path.join(dir, 'NotoSans-Italic.ttf')),
    fs.readFile(path.join(process.cwd(), 'public', 'assets', 'report-mark.png')).catch(() => null),
  ]);
  const L = doc.labels;
  const header = new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 4 } },
        children: [
          ...(logo ? [new ImageRun({ type: 'png', data: logo, transformation: { width: 28, height: 28 }, altText: { name: 'DaktariScribe', description: 'DaktariScribe logo', title: 'DaktariScribe' } })] : []),
          new TextRun({ text: '  DaktariScribe', bold: true, color: NAVY, size: 24 }),
          new TextRun({ text: `   ${doc.orgName}`, color: MUTED, size: 18 }),
        ],
      }),
    ],
  });
  const footer = new Footer({
    children: [
      new Paragraph({ children: [new TextRun({ text: L.t('confidentiality'), size: 14, color: MUTED })] }),
      ...(doc.watermark ? [new Paragraph({ children: [new TextRun({ text: L.t('trialMark'), bold: true, size: 16, color: MUTED })] })] : []),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: [L.t('page', { page: '', total: '' }).split(' ')[0] + ' ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 16, color: MUTED })],
      }),
    ],
  });
  const children: (Paragraph | Table)[] = [];
  if (doc.aggregate && doc.summary) children.push(...summaryChildren(doc));
  doc.records.forEach((r, i) => {
    const block = recordChildren(r, doc);
    if (i > 0 || (doc.aggregate && doc.summary)) children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    children.push(...block);
  });
  const d = new Document({
    creator: 'DaktariScribe',
    title: doc.aggregate ? L.t('aggregateTitle') : `${L.t('reportTitle')} ${doc.records[0]?.id ?? ''}`,
    fonts: [{ name: FONT, data: regular, bold, italic }],
    styles: {
      default: { document: { run: { font: FONT, size: 20 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 30, bold: true, color: NAVY }, paragraph: { spacing: { before: 120, after: 160 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 23, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 100 } } },
      ],
    },
    sections: [{ headers: { default: header }, footers: { default: footer }, children }],
  });
  return Packer.toBuffer(d);
}
