/**
 * Word export (spec §5 Phase 5.1, DESIGN.md §8): same structure and look as the PDF "clinical
 * ledger", built from real Word headings, paragraphs and tables so it stays editable. A navy page
 * border down the left edge is the DaktariScribe signature. Embeds Noto Sans. Server only.
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
  PageBorderDisplay,
  PageBorderOffsetFrom,
  PageBorderZOrder,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
} from 'docx';
import type { ExportDoc, ExportRecord } from './model';
import { provenance } from './model';
import { formatDate } from '@/lib/i18n/labels';

const FONT = 'Noto Sans';
const NAVY = '001D3D';
const TEAL = '006B5C';
const INK = '171C1F';
const MUTED = '5B6069';
const FAINT = '9AA0A8';
const HAIR = 'DDE1E6';
const AMBER = '9A4A07';

/* A4 in twips, with a wider left margin beside the spine. */
const PAGE_W = 11906;
const MARGIN_L = 1360;
const MARGIN_R = 1020;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const INDENT = 420;

const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const hair: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: HAIR };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

const caps = (text: string, opts: { color?: string; bold?: boolean } = {}) => new TextRun({ text, allCaps: true, size: 14, color: opts.color ?? MUTED, bold: opts.bold });

function sectionHeading(no: number, label: string, pageBreakBefore = false) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    pageBreakBefore,
    keepNext: true,
    border: { bottom: { ...hair, space: 4 } },
    spacing: { before: 360, after: 140 },
    children: [new TextRun({ text: `${String(no).padStart(2, '0')}\t`, color: TEAL, size: 17, bold: true }), new TextRun({ text: label })],
    tabStops: [{ type: TabStopType.LEFT, position: INDENT }],
  });
}

function para(text: string) {
  return new Paragraph({ indent: { left: INDENT }, spacing: { after: 100, line: 340 }, children: [new TextRun({ text, size: 20, color: INK })] });
}

function emptyLine(text: string) {
  return new Paragraph({ indent: { left: INDENT }, children: [new TextRun({ text, italics: true, color: FAINT, size: 18 })] });
}

/** Label/value rows with hairlines between them: no boxes, values right-aligned. */
function ledger(rows: { label: string; value: string | null; empty: string }[]) {
  const labelW = Math.round((CONTENT_W - INDENT) * 0.58);
  const valueW = CONTENT_W - INDENT - labelW;
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_W - INDENT, type: WidthType.DXA },
    columnWidths: [labelW, valueW],
    indent: { size: INDENT, type: WidthType.DXA },
    borders: { ...noBorders, insideHorizontal: hair },
    rows: rows.map(
      (r) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: labelW, type: WidthType.DXA },
              margins: { top: 90, bottom: 90, left: 0, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: r.label, color: MUTED, size: 19 })] })],
            }),
            new TableCell({
              width: { size: valueW, type: WidthType.DXA },
              margins: { top: 90, bottom: 90, left: 120, right: 0 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [r.value !== null ? new TextRun({ text: r.value, bold: true, color: INK, size: 19 }) : new TextRun({ text: r.empty, italics: true, color: FAINT, size: 18 })],
                }),
              ],
            }),
          ],
        }),
    ),
  });
}

/** Four-column details grid with hairlines above and below. */
function metaGrid(items: [string, string][]) {
  const colW = Math.floor(CONTENT_W / 4);
  const rows: TableRow[] = [];
  for (let i = 0; i < items.length; i += 4) {
    rows.push(
      new TableRow({
        children: items.slice(i, i + 4).map(
          ([k, v]) =>
            new TableCell({
              width: { size: colW, type: WidthType.DXA },
              margins: { top: 90, bottom: 90, left: 0, right: 160 },
              children: [new Paragraph({ children: [caps(k)] }), new Paragraph({ spacing: { before: 30 }, children: [new TextRun({ text: v, size: 18, color: INK })] })],
            }),
        ),
      }),
    );
  }
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [colW, colW, colW, CONTENT_W - colW * 3],
    borders: { ...noBorders, top: hair, bottom: hair },
    rows,
  });
}

function recordChildren(rec: ExportRecord, doc: ExportDoc): (Paragraph | Table)[] {
  const L = doc.labels;
  const out: (Paragraph | Table)[] = [];
  const final = Boolean(rec.signoff);

  // Title block
  out.push(new Paragraph({ spacing: { after: 80 }, children: [caps(`${L.t('recordId')} ${rec.id}`, { color: TEAL, bold: true })] }));
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(rec.templateName)] }));
  out.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: `${rec.site} · ${formatDate(rec.encounterDate, doc.lang)}`, color: MUTED, size: 21 })],
    }),
  );
  out.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: '● ', color: final ? TEAL : AMBER, size: 16 }), caps(final ? L.t('statusFinal') : L.t('statusDraft'), { color: final ? TEAL : AMBER, bold: true })],
    }),
  );

  out.push(
    metaGrid([
      [L.t('encounterDate'), formatDate(rec.encounterDate, doc.lang)],
      [L.t('site'), rec.site],
      [L.t('author'), rec.workerName],
      [L.t('interviewLanguage'), rec.interviewLanguage],
      [L.t('template'), `${rec.templateName} · v${rec.templateVersion}`],
      [L.t('respondentRef'), rec.respondentRef || L.t('notRecorded')],
      [L.t('consentObtained'), rec.consentObtained ? L.t('yes') : L.t('no')],
      [L.t('version'), rec.versionNo ? `v${rec.versionNo}` : '—'],
    ]),
  );
  if (rec.translationNote) {
    out.push(
      new Paragraph({
        spacing: { before: 200 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: AMBER, space: 6 } },
        children: [new TextRun({ text: rec.translationNote, color: AMBER, size: 17 })],
      }),
    );
  }

  // Content
  let no = 0;
  for (const sec of rec.sections) {
    out.push(sectionHeading(++no, sec.label));
    for (const l of sec.lines) out.push(para(l));
    if (!sec.lines.length && !sec.fields.length) out.push(emptyLine(L.t('notRecorded')));
    if (sec.fields.length) out.push(ledger(sec.fields.map((f) => ({ label: f.label, value: f.value, empty: L.t('notRecorded') }))));
  }
  if (rec.codes.length) {
    out.push(sectionHeading(++no, L.t('suggestedCodes')));
    for (const c of rec.codes) out.push(para(c));
  }

  // Sign-off
  out.push(sectionHeading(++no, L.t('signoffTitle')));
  if (rec.signoff) {
    out.push(
      new Paragraph({
        indent: { left: INDENT },
        spacing: { after: 200, line: 320 },
        border: { left: { style: BorderStyle.SINGLE, size: 16, color: TEAL, space: 8 } },
        keepNext: true,
        children: [new TextRun({ text: rec.signoff.statement, italics: true, color: INK, size: 19 })],
      }),
    );
  } else out.push(emptyLine(L.t('notSignedOff')));

  const half = Math.floor((CONTENT_W - INDENT) / 2);
  const sigCell = (label: string, value: string | null, line: boolean) =>
    new TableCell({
      width: { size: half, type: WidthType.DXA },
      verticalAlign: VerticalAlign.BOTTOM,
      margins: { top: line ? 480 : 60, bottom: 60, left: 0, right: 0 },
      children: line
        ? // The line is a paragraph border with a right indent, so the two lines stay separate.
          [new Paragraph({ indent: { right: 420 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: INK, space: 1 } }, children: [] })]
        : [new Paragraph({ children: [caps(label)] }), new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: value ?? '', bold: true, size: 20, color: INK })] })],
    });
  const sigRows: TableRow[] = [];
  if (rec.signoff) sigRows.push(new TableRow({ cantSplit: true, children: [sigCell(L.t('signedOffBy'), rec.signoff.name, false), sigCell(L.t('dateTime'), formatDate(rec.signoff.at, doc.lang, true), false)] }));
  sigRows.push(new TableRow({ cantSplit: true, children: [sigCell('', null, true), sigCell('', null, true)] }));
  sigRows.push(
    new TableRow({
      cantSplit: true,
      children: [L.t('signature'), L.t('stamp')].map(
        (t) => new TableCell({ width: { size: half, type: WidthType.DXA }, margins: { top: 50, bottom: 0, left: 0, right: 360 }, children: [new Paragraph({ children: [caps(t)] })] }),
      ),
    }),
  );
  out.push(
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: CONTENT_W - INDENT, type: WidthType.DXA },
      columnWidths: [half, CONTENT_W - INDENT - half],
      indent: { size: INDENT, type: WidthType.DXA },
      borders: noBorders,
      rows: sigRows,
    }),
  );
  out.push(
    new Paragraph({
      spacing: { before: 320 },
      border: { top: { ...hair, space: 6 } },
      children: [new TextRun({ text: `${provenance(rec, L)} ${L.t('exported', { date: formatDate(doc.exportedAt, doc.lang, true) })}`, size: 16, color: MUTED })],
    }),
  );

  if (rec.originals?.length) {
    out.push(sectionHeading(++no, L.t('appendixTranscript'), true));
    for (const o of rec.originals) {
      out.push(new Paragraph({ indent: { left: INDENT }, spacing: { before: 120, after: 60 }, children: [caps(o.label, { color: TEAL, bold: true })] }));
      // Blank lines become paragraph spacing rather than empty paragraphs.
      for (const line of o.text.split('\n').filter((l) => l.trim())) out.push(para(line));
    }
  }
  return out;
}

function summaryChildren(doc: ExportDoc): (Paragraph | Table)[] {
  const L = doc.labels;
  const s = doc.summary!;
  const out: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 80 }, children: [caps(doc.orgName || 'DaktariScribe', { color: TEAL, bold: true })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(L.t('aggregateTitle'))] }),
    new Paragraph({
      spacing: { after: 280 },
      children: [new TextRun({ text: `${L.t('period')}: ${s.from ? formatDate(s.from, doc.lang) : '—'} – ${s.to ? formatDate(s.to, doc.lang) : '—'}`, color: MUTED, size: 21 })],
    }),
  ];
  const stats: [string, number][] = [
    [L.t('records'), s.records],
    [L.t('sites'), s.sites.length],
    [L.t('workers'), s.workers],
    [L.t('followUpsDue'), doc.followUps?.length ?? 0],
  ];
  const colW = Math.floor(CONTENT_W / 4);
  out.push(
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [colW, colW, colW, CONTENT_W - colW * 3],
      borders: noBorders,
      rows: [
        new TableRow({
          children: stats.map(
            ([label, value]) =>
              new TableCell({
                width: { size: colW, type: WidthType.DXA },
                margins: { top: 120, bottom: 80, left: 0, right: 240 },
                borders: { top: { style: BorderStyle.SINGLE, size: 18, color: TEAL }, bottom: none, left: none, right: none },
                children: [new Paragraph({ children: [new TextRun({ text: String(value), bold: true, size: 44, color: NAVY })] }), new Paragraph({ children: [caps(label)] })],
              }),
          ),
        }),
      ],
    }),
  );
  if (s.sites.length) out.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: `${L.t('sites')}: ${s.sites.join(', ')}`, size: 17, color: MUTED })] }));

  let no = 0;
  for (const m of doc.metrics ?? []) {
    out.push(sectionHeading(++no, m.label));
    out.push(ledger(m.points.map((p) => ({ label: p.label, value: `${p.value}${m.unit ? ` ${m.unit}` : ''}`, empty: '' }))));
  }
  out.push(sectionHeading(++no, L.t('followUpsDue')));
  if (doc.followUps?.length) {
    out.push(ledger(doc.followUps.map((f) => ({ label: `${f.label} · ${f.site} · ${f.recordId}`, value: formatDate(f.date, doc.lang), empty: '' }))));
  } else out.push(emptyLine(L.t('noFollowUps')));
  return out;
}

export async function renderDocx(doc: ExportDoc): Promise<Buffer> {
  const dir = path.join(process.cwd(), 'public', 'fonts');
  // Missing font or logo files must not fail the download: the document then uses Word's own font.
  const read = (p: string) => fs.readFile(p).catch(() => null);
  const [regular, bold, italic, logo] = await Promise.all([
    read(path.join(dir, 'NotoSans-Regular.ttf')),
    read(path.join(dir, 'NotoSans-Bold.ttf')),
    read(path.join(dir, 'NotoSans-Italic.ttf')),
    read(path.join(process.cwd(), 'public', 'assets', 'report-mark.png')),
  ]);
  const embedFonts = Boolean(regular && bold && italic);
  const L = doc.labels;
  const docTitle = doc.aggregate ? L.t('aggregateTitle') : L.t('reportTitle');
  const ref = doc.aggregate ? `${doc.records.length} ${L.t('records').toLowerCase()}` : (doc.records[0]?.id ?? '');

  const header = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        border: { bottom: { ...hair, space: 6 } },
        spacing: { after: 240 },
        children: [
          ...(logo ? [new ImageRun({ type: 'png', data: logo, transformation: { width: 18, height: 18 }, altText: { name: 'DaktariScribe', description: 'DaktariScribe logo', title: 'DaktariScribe' } })] : []),
          new TextRun({ text: '  DaktariScribe', bold: true, color: NAVY, size: 19 }),
          ...(doc.orgName ? [new TextRun({ text: `   ${doc.orgName}`, color: MUTED, size: 16 })] : []),
          new TextRun({ text: '\t' }),
          caps(docTitle, { color: NAVY, bold: true }),
        ],
      }),
    ],
  });

  const footerW = Math.round(CONTENT_W * 0.7);
  const footer = new Footer({
    children: [
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [footerW, CONTENT_W - footerW],
        borders: { ...noBorders, top: hair },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: footerW, type: WidthType.DXA },
                margins: { top: 100, bottom: 0, left: 0, right: 200 },
                children: [
                  new Paragraph({ children: [new TextRun({ text: L.t('confidentiality'), size: 13, color: FAINT })] }),
                  ...(doc.watermark ? [new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: L.t('trialMark'), bold: true, size: 13, color: AMBER })] })] : []),
                ],
              }),
              new TableCell({
                width: { size: CONTENT_W - footerW, type: WidthType.DXA },
                margins: { top: 100, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: ref, bold: true, size: 14, color: MUTED })] }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], bold: true, size: 14, color: MUTED })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const children: (Paragraph | Table)[] = [];
  if (doc.aggregate && doc.summary) children.push(...summaryChildren(doc));
  doc.records.forEach((r, i) => {
    if (i > 0 || (doc.aggregate && doc.summary)) children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    children.push(...recordChildren(r, doc));
  });

  const d = new Document({
    creator: 'DaktariScribe',
    title: `${docTitle} ${ref}`.trim(),
    description: L.t('confidentiality'),
    ...(embedFonts ? { fonts: [{ name: FONT, data: regular!, bold: bold!, italic: italic! }] } : {}),
    styles: {
      default: { document: { run: { font: FONT, size: 20, color: INK } } },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: FONT, size: 44, bold: true, color: NAVY },
          paragraph: { spacing: { before: 0, after: 60 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: { font: FONT, size: 23, bold: true, color: NAVY },
          paragraph: { spacing: { before: 360, after: 140 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, bottom: 1000, left: MARGIN_L, right: MARGIN_R, header: 500, footer: 450 },
            borders: {
              pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.PAGE, zOrder: PageBorderZOrder.BACK },
              pageBorderLeft: { style: BorderStyle.SINGLE, size: 72, color: NAVY, space: 0 },
            },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children,
      },
    ],
  });
  return Packer.toBuffer(d);
}
