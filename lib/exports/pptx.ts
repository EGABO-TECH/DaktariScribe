/**
 * Slide deck export (spec §5 Phase 5.1, DESIGN.md §8) with pptxgenjs. Server only.
 * Title slide → summary (headline numbers) → one native bar chart per metric field (skipped
 * when the template has no metric fields) → records in the deck → follow-ups due.
 * Every figure comes from ExportDoc (SQL aggregates of confirmed fields); nothing is invented.
 *
 * Design matches the PDF and Word "clinical ledger": a navy spine with a teal cap on the left
 * edge, a quiet running header, no boxes (hairline rules only), large unboxed figures.
 * Charts: one series each → single brand hue, no legend box (the title names the measure),
 * value labels on bars, recessive grid, one value axis.
 */
import PptxGenJS from 'pptxgenjs';
import type { ExportDoc } from './model';
import { formatDate } from '@/lib/i18n/labels';

const NAVY = '001D3D';
const TEAL = '006B5C';
const TEAL_LIGHT = '44DDC1';
const INK = '171C1F';
const MUTED = '5B6069';
const FAINT = '9AA0A8';
const HAIR = 'DDE1E6';
const FONT = 'Noto Sans';

const X0 = 0.75; // content left edge (beside the spine)
const W = 13.333 - X0 - 0.6; // content width

type Cell = { text: string; options?: Record<string, unknown> };

/** Table with hairlines between rows only; a navy rule under the header. */
function ledgerTable(head: string[], rows: string[][]): Cell[][] {
  const none = { type: 'none' as const };
  const rule = { type: 'solid' as const, pt: 0.75, color: HAIR };
  const headRule = { type: 'solid' as const, pt: 1.25, color: NAVY };
  return [
    head.map((t) => ({ text: t.toUpperCase(), options: { bold: true, color: NAVY, fontSize: 10, border: [none, none, headRule, none] } })),
    ...rows.map((r) => r.map((t, i) => ({ text: t, options: { color: i === 0 ? NAVY : INK, bold: i === 0, border: [none, none, rule, none] } }))),
  ];
}

export async function renderPptx(doc: ExportDoc, logo?: Buffer | null): Promise<Buffer> {
  const L = doc.labels;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5 in
  pptx.title = L.t('aggregateTitle');
  pptx.company = 'DaktariScribe';
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  const logoData = logo ? `data:image/png;base64,${logo.toString('base64')}` : null;

  const footerText = `${L.t('confidentiality')}${doc.watermark ? `   ·   ${L.t('trialMark')}` : ''}`;

  pptx.defineSlideMaster({
    title: 'DS',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 0, w: 0.16, h: 7.5, fill: { color: NAVY }, line: { color: NAVY, width: 0 } } },
      { rect: { x: 0, y: 0, w: 0.16, h: 1.4, fill: { color: TEAL }, line: { color: TEAL, width: 0 } } },
      ...(logoData ? [{ image: { data: logoData, x: X0, y: 0.32, w: 0.32, h: 0.32 } }] : []),
      { text: { text: 'DaktariScribe', options: { x: X0 + (logoData ? 0.4 : 0), y: 0.3, w: 3, h: 0.36, fontFace: FONT, fontSize: 12, bold: true, color: NAVY } } },
      {
        text: {
          text: L.t('aggregateTitle').toUpperCase(),
          options: { x: X0 + W - 5, y: 0.3, w: 5, h: 0.36, align: 'right', fontFace: FONT, fontSize: 9, bold: true, color: MUTED },
        },
      },
      { line: { x: X0, y: 0.82, w: W, h: 0, line: { color: HAIR, width: 0.75 } } },
      { line: { x: X0, y: 6.85, w: W, h: 0, line: { color: HAIR, width: 0.75 } } },
      { text: { text: footerText, options: { x: X0, y: 6.9, w: W - 1, h: 0.45, fontFace: FONT, fontSize: 7.5, color: FAINT, valign: 'top' } } },
    ],
    slideNumber: { x: X0 + W - 0.7, y: 6.95, w: 0.7, h: 0.3, align: 'right', fontFace: FONT, fontSize: 9, bold: true, color: MUTED },
  });

  const heading = (slide: PptxGenJS.Slide, no: number, text: string) => {
    slide.addText(String(no).padStart(2, '0'), { x: X0, y: 1.05, w: 0.6, h: 0.6, fontFace: FONT, fontSize: 14, bold: true, color: TEAL, valign: 'middle' });
    slide.addText(text, { x: X0 + 0.6, y: 1.05, w: W - 0.6, h: 0.6, fontFace: FONT, fontSize: 24, bold: true, color: NAVY, valign: 'middle' });
    slide.addShape(pptx.ShapeType.line, { x: X0, y: 1.75, w: W, h: 0, line: { color: HAIR, width: 0.75 } });
  };

  const s = doc.summary;
  const period = s ? `${s.from ? formatDate(s.from, doc.lang) : '—'} – ${s.to ? formatDate(s.to, doc.lang) : '—'}` : '';
  let no = 0;

  // Title: navy panel with the mark, title on white.
  const title = pptx.addSlide();
  title.background = { color: 'FFFFFF' };
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 4.6, h: 7.5, fill: { color: NAVY }, line: { color: NAVY, width: 0 } });
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 4.6, h: 0.12, fill: { color: TEAL }, line: { color: TEAL, width: 0 } });
  if (logoData) {
    title.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 0.85, w: 1.0, h: 1.0, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF', width: 0 }, rectRadius: 0.15 });
    title.addImage({ data: logoData, x: 0.9, y: 0.95, w: 0.8, h: 0.8 });
  }
  title.addText('DaktariScribe', { x: 0.8, y: 2.05, w: 3.5, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: 'FFFFFF' });
  title.addText(doc.orgName, { x: 0.8, y: 2.55, w: 3.5, h: 0.4, fontFace: FONT, fontSize: 12, color: TEAL_LIGHT });
  title.addText(L.t('confidentiality'), { x: 0.8, y: 5.9, w: 3.2, h: 1.0, fontFace: FONT, fontSize: 8, color: 'B8C4D2', valign: 'bottom' });
  title.addText((doc.orgName || 'DaktariScribe').toUpperCase(), { x: 5.4, y: 2.35, w: 7.3, h: 0.4, fontFace: FONT, fontSize: 11, bold: true, color: TEAL });
  title.addText(L.t('aggregateTitle'), { x: 5.4, y: 2.75, w: 7.3, h: 1.4, fontFace: FONT, fontSize: 40, bold: true, color: NAVY, valign: 'top' });
  if (period) title.addText(`${L.t('period')}: ${period}`, { x: 5.4, y: 4.2, w: 7.3, h: 0.5, fontFace: FONT, fontSize: 16, color: MUTED });
  title.addShape(pptx.ShapeType.line, { x: 5.4, y: 4.95, w: 1.2, h: 0, line: { color: TEAL, width: 2.5 } });
  title.addText(L.t('exported', { date: formatDate(doc.exportedAt, doc.lang, true) }), { x: 5.4, y: 5.1, w: 7.3, h: 0.4, fontFace: FONT, fontSize: 11, color: FAINT });
  if (doc.watermark) title.addText(L.t('trialMark'), { x: 5.4, y: 5.5, w: 7.3, h: 0.4, fontFace: FONT, fontSize: 11, bold: true, color: '9A4A07' });

  // Summary: large unboxed figures, each under a teal rule.
  if (s) {
    const sum = pptx.addSlide({ masterName: 'DS' });
    heading(sum, ++no, L.t('summary'));
    const tiles: [string, string][] = [
      [L.t('records'), String(s.records)],
      [L.t('sites'), String(s.sites.length)],
      [L.t('workers'), String(s.workers)],
      [L.t('followUpsDue'), String(doc.followUps?.length ?? 0)],
    ];
    const gap = 0.4;
    const tw = (W - gap * 3) / 4;
    tiles.forEach(([label, value], i) => {
      const x = X0 + i * (tw + gap);
      sum.addShape(pptx.ShapeType.line, { x, y: 2.3, w: tw, h: 0, line: { color: TEAL, width: 2.5 } });
      sum.addText(value, { x, y: 2.45, w: tw, h: 1.2, fontFace: FONT, fontSize: 60, bold: true, color: NAVY, valign: 'top', margin: 0 });
      sum.addText(label.toUpperCase(), { x, y: 3.7, w: tw, h: 0.4, fontFace: FONT, fontSize: 11, bold: true, color: MUTED, margin: 0 });
    });
    sum.addText(
      [
        { text: `${L.t('period')}  `, options: { bold: true, color: NAVY } },
        { text: period, options: { color: INK, breakLine: true } },
        { text: `${L.t('sites')}  `, options: { bold: true, color: NAVY } },
        { text: s.sites.join(', ') || '—', options: { color: INK } },
      ],
      { x: X0, y: 4.7, w: W, h: 1.4, fontFace: FONT, fontSize: 14, valign: 'top', paraSpaceAfter: 6, margin: 0 },
    );
  }

  // One native chart per metric field
  for (const m of doc.metrics ?? []) {
    if (!m.points.length) continue;
    const slide = pptx.addSlide({ masterName: 'DS' });
    heading(slide, ++no, m.label + (m.unit ? ` (${m.unit})` : ''));
    slide.addChart(pptx.ChartType.bar, [{ name: m.label, labels: m.points.map((p) => p.label), values: m.points.map((p) => p.value) }], {
      x: X0,
      y: 2.0,
      w: W,
      h: 4.6,
      barDir: m.points.length > 8 ? 'bar' : 'col',
      barGapWidthPct: 70,
      chartColors: [TEAL],
      showLegend: false,
      showValue: true,
      dataLabelFontFace: FONT,
      dataLabelFontSize: 12,
      dataLabelFontBold: true,
      // "General" shows the value exactly as recorded (38.5, not a rounded 39).
      dataLabelFormatCode: 'General',
      dataLabelColor: NAVY,
      catAxisLabelFontFace: FONT,
      catAxisLabelFontSize: 11,
      catAxisLabelColor: MUTED,
      catAxisLineShow: true,
      catAxisLineColor: HAIR,
      valAxisLabelFontFace: FONT,
      valAxisLabelFontSize: 10,
      valAxisLabelColor: FAINT,
      valAxisLineShow: false,
      valGridLine: { color: HAIR, size: 0.5 },
      catGridLine: { style: 'none' },
      valAxisMinVal: 0,
    });
  }

  // Records in this deck
  const rows = doc.records.map((r) => [r.id, formatDate(r.encounterDate, doc.lang), r.site, r.templateName]);
  const recordsNo = ++no;
  for (let i = 0; i < Math.max(1, rows.length); i += 10) {
    const slide = pptx.addSlide({ masterName: 'DS' });
    heading(slide, recordsNo, L.t('recordsInReport'));
    slide.addTable(ledgerTable([L.t('recordId'), L.t('encounterDate'), L.t('site'), L.t('template')], rows.slice(i, i + 10)) as PptxGenJS.TableRow[], {
      x: X0,
      y: 2.0,
      w: W,
      fontFace: FONT,
      fontSize: 12,
      color: INK,
      rowH: 0.42,
      margin: [0.06, 0.1, 0.06, 0],
      colW: [W * 0.33, W * 0.18, W * 0.25, W * 0.24],
    });
  }

  // Follow-ups due
  const fu = pptx.addSlide({ masterName: 'DS' });
  heading(fu, ++no, L.t('followUpsDue'));
  if (doc.followUps?.length) {
    fu.addTable(
      ledgerTable(
        [L.t('dateTime'), L.t('template'), L.t('site'), L.t('recordId')],
        doc.followUps.slice(0, 10).map((f) => [formatDate(f.date, doc.lang), f.label, f.site, f.recordId]),
      ) as PptxGenJS.TableRow[],
      { x: X0, y: 2.0, w: W, fontFace: FONT, fontSize: 12, color: INK, rowH: 0.42, margin: [0.06, 0.1, 0.06, 0] },
    );
  } else {
    fu.addText(L.t('noFollowUps'), { x: X0 + 0.6, y: 2.1, w: W - 0.6, h: 0.6, fontFace: FONT, fontSize: 16, italic: true, color: FAINT, margin: 0 });
  }

  const out = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return Buffer.from(out);
}
