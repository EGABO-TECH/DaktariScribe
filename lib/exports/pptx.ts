/**
 * Slide deck export (spec §5 Phase 5.1) with pptxgenjs. Server only.
 * Title slide → summary (headline numbers) → one native bar chart per metric field (skipped
 * when the template has no metric fields) → records in the deck → follow-ups due.
 * Every figure comes from ExportDoc (SQL aggregates of confirmed fields); nothing is invented.
 * Charts: one series each → single brand hue, no legend box (the title names the measure),
 * value labels on bars, recessive grid, one value axis.
 */
import PptxGenJS from 'pptxgenjs';
import type { ExportDoc } from './model';
import { formatDate } from '@/lib/i18n/labels';

const NAVY = '001D3D';
const TEAL = '006B5C';
const INK = '171C1F';
const MUTED = '43474F';
const GRID = 'DFE3E6';
const FONT = 'Noto Sans';

export async function renderPptx(doc: ExportDoc, logo?: Buffer | null): Promise<Buffer> {
  const L = doc.labels;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5 in
  pptx.title = L.t('aggregateTitle');
  pptx.company = 'DaktariScribe';
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

  const footerText = `${L.t('confidentiality')}${doc.watermark ? `   ·   ${L.t('trialMark')}` : ''}`;
  pptx.defineSlideMaster({
    title: 'DS',
    background: { color: 'FFFFFF' },
    objects: [
      { rect: { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: NAVY } } },
      ...(logo ? [{ image: { data: `data:image/png;base64,${logo.toString('base64')}`, x: 0.4, y: 0.25, w: 0.45, h: 0.45 } }] : []),
      { text: { text: 'DaktariScribe', options: { x: 0.95, y: 0.25, w: 4, h: 0.45, fontFace: FONT, fontSize: 14, bold: true, color: NAVY } } },
      { text: { text: footerText, options: { x: 0.4, y: 6.9, w: 11.2, h: 0.45, fontFace: FONT, fontSize: 8, color: MUTED } } },
    ],
    slideNumber: { x: 12.3, y: 6.95, w: 0.7, h: 0.35, fontFace: FONT, fontSize: 9, color: MUTED },
  });

  const s = doc.summary;
  const period = s ? `${s.from ? formatDate(s.from, doc.lang) : '—'} – ${s.to ? formatDate(s.to, doc.lang) : '—'}` : '';

  // Title
  const title = pptx.addSlide({ masterName: 'DS' });
  title.addText(L.t('aggregateTitle'), { x: 0.6, y: 2.2, w: 12, h: 1, fontFace: FONT, fontSize: 36, bold: true, color: NAVY });
  title.addText(`${doc.orgName}\n${period}`, { x: 0.6, y: 3.3, w: 12, h: 1, fontFace: FONT, fontSize: 18, color: MUTED });
  title.addText(L.t('exported', { date: formatDate(doc.exportedAt, doc.lang, true) }), { x: 0.6, y: 4.5, w: 12, h: 0.5, fontFace: FONT, fontSize: 12, color: MUTED });

  // Summary: headline numbers (stat tiles, not a chart)
  if (s) {
    const sum = pptx.addSlide({ masterName: 'DS' });
    sum.addText(L.t('summary'), { x: 0.6, y: 0.9, w: 12, h: 0.7, fontFace: FONT, fontSize: 26, bold: true, color: NAVY });
    const tiles: [string, string][] = [
      [L.t('records'), String(s.records)],
      [L.t('sites'), String(s.sites.length)],
      [L.t('workers'), String(s.workers)],
      [L.t('followUpsDue'), String(doc.followUps?.length ?? 0)],
    ];
    tiles.forEach(([label, value], i) => {
      const x = 0.6 + i * 3.1;
      sum.addShape(pptx.ShapeType.rect, { x, y: 1.9, w: 2.9, h: 1.9, fill: { color: 'F6FAFD' }, line: { color: GRID, width: 1 } });
      sum.addText(value, { x, y: 2.05, w: 2.9, h: 1.0, align: 'center', fontFace: FONT, fontSize: 44, bold: true, color: NAVY });
      sum.addText(label, { x, y: 3.05, w: 2.9, h: 0.55, align: 'center', fontFace: FONT, fontSize: 14, color: MUTED });
    });
    sum.addText(`${L.t('period')}: ${period}\n${L.t('sites')}: ${s.sites.join(', ')}`, { x: 0.6, y: 4.2, w: 12, h: 1.2, fontFace: FONT, fontSize: 14, color: INK, valign: 'top' });
  }

  // One native chart per metric field
  for (const m of doc.metrics ?? []) {
    if (!m.points.length) continue;
    const slide = pptx.addSlide({ masterName: 'DS' });
    slide.addText(m.label + (m.unit ? ` (${m.unit})` : ''), { x: 0.6, y: 0.9, w: 12, h: 0.7, fontFace: FONT, fontSize: 22, bold: true, color: NAVY });
    slide.addChart(pptx.ChartType.bar, [{ name: m.label, labels: m.points.map((p) => p.label), values: m.points.map((p) => p.value) }], {
      x: 0.6,
      y: 1.7,
      w: 12,
      h: 4.9,
      barDir: m.points.length > 8 ? 'bar' : 'col',
      barGapWidthPct: 60,
      chartColors: [TEAL],
      showLegend: false,
      showValue: true,
      dataLabelFontFace: FONT,
      dataLabelFontSize: 11,
      dataLabelColor: INK,
      catAxisLabelFontFace: FONT,
      catAxisLabelFontSize: 11,
      catAxisLabelColor: MUTED,
      valAxisLabelFontFace: FONT,
      valAxisLabelFontSize: 10,
      valAxisLabelColor: MUTED,
      valGridLine: { color: GRID, size: 0.5 },
      catGridLine: { style: 'none' },
      valAxisMinVal: 0,
    });
  }

  // Records in this deck
  const rows = doc.records.map((r) => [r.id, formatDate(r.encounterDate, doc.lang), r.site, r.templateName]);
  for (let i = 0; i < Math.max(1, rows.length); i += 12) {
    const slide = pptx.addSlide({ masterName: 'DS' });
    slide.addText(L.t('recordsInReport'), { x: 0.6, y: 0.9, w: 12, h: 0.7, fontFace: FONT, fontSize: 22, bold: true, color: NAVY });
    const head = [L.t('recordId'), L.t('encounterDate'), L.t('site'), L.t('template')].map((t) => ({ text: t, options: { bold: true, color: NAVY, fill: { color: 'F0F4F7' } } }));
    slide.addTable([head, ...rows.slice(i, i + 12).map((r) => r.map((t) => ({ text: t })))], {
      x: 0.6,
      y: 1.7,
      w: 12,
      fontFace: FONT,
      fontSize: 11,
      color: INK,
      border: { type: 'solid', color: GRID, pt: 0.75 },
      colW: [3.6, 2.2, 3.2, 3],
    });
  }

  // Follow-ups due
  const fu = pptx.addSlide({ masterName: 'DS' });
  fu.addText(L.t('followUpsDue'), { x: 0.6, y: 0.9, w: 12, h: 0.7, fontFace: FONT, fontSize: 22, bold: true, color: NAVY });
  if (doc.followUps?.length) {
    const head = [L.t('dateTime'), L.t('template'), L.t('site'), L.t('recordId')].map((t) => ({ text: t, options: { bold: true, color: NAVY, fill: { color: 'F0F4F7' } } }));
    fu.addTable([head, ...doc.followUps.slice(0, 12).map((f) => [formatDate(f.date, doc.lang), f.label, f.site, f.recordId].map((t) => ({ text: t })))], {
      x: 0.6,
      y: 1.7,
      w: 12,
      fontFace: FONT,
      fontSize: 11,
      color: INK,
      border: { type: 'solid', color: GRID, pt: 0.75 },
    });
  } else {
    fu.addText(L.t('noFollowUps'), { x: 0.6, y: 1.8, w: 12, h: 0.6, fontFace: FONT, fontSize: 14, italic: true, color: MUTED });
  }

  const out = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return Buffer.from(out);
}
