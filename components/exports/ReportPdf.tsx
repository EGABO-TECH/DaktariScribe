/**
 * Branded PDF report (spec §5 Phase 1.6 / 5.1) for one or many Final records. Rendered on the
 * server and, for offline drafts, in the browser with the same component.
 * Embeds Noto Sans (Latin; Ethiopic and Arabic for those output languages) so every script renders.
 * react-pdf 4.x notes: no page-level lineHeight (it hides render-prop page numbers); fixed
 * bottom-anchored Views need an explicit height.
 */
import React from 'react';
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ExportDoc, ExportRecord } from '@/lib/exports/model';
import { provenance } from '@/lib/exports/model';
import { formatDate } from '@/lib/i18n/labels';

let registeredBase: string | null = null;
/** Registers Noto fonts from a directory (server: absolute path) or URL prefix (browser: "/fonts"). */
export function registerReportFonts(base: string) {
  if (registeredBase === base) return;
  const f = (name: string) => `${base.replace(/[\\/]$/, '')}/${name}`;
  Font.register({
    family: 'NotoSans',
    fonts: [
      { src: f('NotoSans-Regular.ttf') },
      { src: f('NotoSans-Bold.ttf'), fontWeight: 'bold' },
      { src: f('NotoSans-Italic.ttf'), fontStyle: 'italic' },
    ],
  });
  Font.register({ family: 'NotoSansEthiopic', src: f('NotoSansEthiopic-Regular.ttf') });
  Font.register({ family: 'NotoSansArabic', src: f('NotoSansArabic-Regular.ttf') });
  Font.registerHyphenationCallback((word) => [word]);
  registeredBase = base;
}

const NAVY = '#001d3d';
const TEAL = '#006b5c';
const INK = '#171c1f';
const MUTED = '#43474f';
const RULE = '#c3c6d0';
const SOFT = '#f0f4f7';

function familyFor(lang: string, fontsRegistered: boolean) {
  if (!fontsRegistered) return { regular: 'Helvetica', bold: 'Helvetica-Bold' };
  if (lang === 'amh') return { regular: 'NotoSansEthiopic', bold: 'NotoSansEthiopic' };
  if (lang === 'ara') return { regular: 'NotoSansArabic', bold: 'NotoSansArabic' };
  return { regular: 'NotoSans', bold: 'NotoSans' };
}

function makeStyles(fam: { regular: string; bold: string }, noto: boolean) {
  const bold = noto && fam.bold === 'NotoSans' ? { fontFamily: fam.bold, fontWeight: 'bold' as const } : { fontFamily: fam.bold };
  return StyleSheet.create({
    page: { paddingTop: 40, paddingBottom: 80, paddingHorizontal: 44, fontFamily: fam.regular, fontSize: 9.5, color: INK },
    header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 10, marginBottom: 14 },
    logo: { width: 34, height: 34, marginRight: 10 },
    brand: { ...bold, fontSize: 13, color: NAVY },
    org: { fontSize: 8.5, color: MUTED },
    titleBlock: { marginLeft: 'auto', alignItems: 'flex-end' },
    title: { ...bold, fontSize: 14, color: NAVY },
    subtitle: { fontSize: 9, color: MUTED },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: RULE, marginBottom: 14 },
    metaCell: { width: '33.33%', padding: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: RULE },
    metaLabel: { fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
    metaValue: { ...bold, fontSize: 9.5, color: INK },
    sectionHeading: { ...bold, fontSize: 10.5, color: NAVY, backgroundColor: SOFT, paddingVertical: 4, paddingHorizontal: 6, marginTop: 10, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: TEAL },
    line: { marginBottom: 5, paddingHorizontal: 6, lineHeight: 1.45 },
    empty: { color: MUTED, fontStyle: 'italic', paddingHorizontal: 6, lineHeight: 1.45 },
    table: { borderWidth: 1, borderColor: RULE, marginBottom: 4 },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: RULE },
    rowLast: { flexDirection: 'row' },
    cellLabel: { width: '45%', padding: 5, borderRightWidth: 1, borderRightColor: RULE, color: MUTED },
    cellValue: { ...bold, width: '55%', padding: 5 },
    notRecorded: { width: '55%', padding: 5, color: MUTED, fontStyle: 'italic' },
    signature: { marginTop: 16, borderWidth: 1, borderColor: NAVY, padding: 10 },
    sigTitle: { ...bold, fontSize: 10, color: NAVY, marginBottom: 6 },
    sigRow: { flexDirection: 'row', marginTop: 12 },
    sigCol: { width: '50%' },
    sigLine: { borderBottomWidth: 1, borderBottomColor: INK, height: 18, marginRight: 16 },
    small: { marginTop: 10, fontSize: 8.5, color: MUTED, lineHeight: 1.45 },
    note: { marginBottom: 10, fontSize: 8.5, color: '#78350f', backgroundColor: '#fef3c7', padding: 6 },
    footer: { position: 'absolute', bottom: 16, left: 44, right: 44, height: 54, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 6 },
    footerText: { fontSize: 7, color: MUTED, lineHeight: 1.35 },
    footerMeta: { ...bold, fontSize: 7.5, color: MUTED, marginTop: 4 },
    watermark: { position: 'absolute', top: 380, left: 0, right: 0, height: 60, textAlign: 'center', fontSize: 40, color: '#eef1f4', transform: 'rotate(-30deg)' },
    summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    summaryCell: { flexGrow: 1, borderWidth: 1, borderColor: RULE, padding: 8 },
    summaryValue: { ...bold, fontSize: 16, color: NAVY },
  });
}

type S = ReturnType<typeof makeStyles>;

function RecordBlock({ rec, doc, s }: { rec: ExportRecord; doc: ExportDoc; s: S }) {
  const L = doc.labels;
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
  return (
    <View>
      {rec.translationNote ? <Text style={s.note}>{rec.translationNote}</Text> : null}
      <View style={s.metaGrid}>
        {meta.map(([label, value]) => (
          <View key={label} style={s.metaCell}>
            <Text style={s.metaLabel}>{label}</Text>
            <Text style={s.metaValue}>{value}</Text>
          </View>
        ))}
      </View>
      {rec.sections.map((sec) => (
        <View key={sec.key} wrap={sec.fields.length > 12}>
          <Text style={s.sectionHeading}>{sec.label}</Text>
          {sec.lines.map((l, i) => (
            <Text key={i} style={s.line}>
              {l}
            </Text>
          ))}
          {!sec.lines.length && !sec.fields.length ? <Text style={s.empty}>{L.t('notRecorded')}</Text> : null}
          {sec.fields.length ? (
            <View style={s.table}>
              {sec.fields.map((f, i) => (
                <View key={f.key} style={i === sec.fields.length - 1 ? s.rowLast : s.row}>
                  <Text style={s.cellLabel}>{f.label}</Text>
                  {f.value !== null ? <Text style={s.cellValue}>{f.value}</Text> : <Text style={s.notRecorded}>{L.t('notRecorded')}</Text>}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ))}
      {rec.codes.length ? (
        <View>
          <Text style={s.sectionHeading}>{L.t('suggestedCodes')}</Text>
          {rec.codes.map((c) => (
            <Text key={c} style={s.line}>
              {c}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={s.signature} wrap={false}>
        <Text style={s.sigTitle}>{L.t('signoffTitle')}</Text>
        {rec.signoff ? (
          <>
            <Text style={{ lineHeight: 1.45 }}>{rec.signoff.statement}</Text>
            <View style={s.sigRow}>
              <View style={s.sigCol}>
                <Text style={s.metaLabel}>{L.t('signedOffBy')}</Text>
                <Text style={s.metaValue}>{rec.signoff.name}</Text>
              </View>
              <View style={s.sigCol}>
                <Text style={s.metaLabel}>{L.t('dateTime')}</Text>
                <Text style={s.metaValue}>{formatDate(rec.signoff.at, doc.lang, true)}</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={s.empty}>{L.t('notSignedOff')}</Text>
        )}
        <View style={s.sigRow}>
          <View style={s.sigCol}>
            <Text style={s.metaLabel}>{L.t('signature')}</Text>
            <View style={s.sigLine} />
          </View>
          <View style={s.sigCol}>
            <Text style={s.metaLabel}>{L.t('stamp')}</Text>
            <View style={s.sigLine} />
          </View>
        </View>
      </View>
      <Text style={s.small}>
        {provenance(rec, L)} {L.t('exported', { date: formatDate(doc.exportedAt, doc.lang, true) })}
      </Text>
      {rec.originals?.length ? (
        <View break>
          <Text style={s.sectionHeading}>{L.t('appendixTranscript')}</Text>
          {rec.originals.map((o, i) => (
            <View key={i}>
              <Text style={s.metaLabel}>{o.label}</Text>
              <Text style={s.line}>{o.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export type ReportPdfProps = { doc: ExportDoc; logoSrc?: Buffer | string; fontsRegistered?: boolean };

export function ReportPdf({ doc, logoSrc, fontsRegistered = false }: ReportPdfProps) {
  const fam = familyFor(doc.lang, fontsRegistered);
  const s = makeStyles(fam, fontsRegistered);
  const L = doc.labels;
  const title = doc.aggregate ? L.t('aggregateTitle') : L.t('reportTitle');
  const subtitle = doc.aggregate ? `${doc.records.length} ${L.t('records').toLowerCase()}` : doc.records[0]?.id ?? '';
  const header = (
    <View style={s.header} fixed>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
      {logoSrc ? <Image src={logoSrc} style={s.logo} /> : null}
      <View>
        <Text style={s.brand}>DaktariScribe</Text>
        <Text style={s.org}>{doc.orgName}</Text>
      </View>
      <View style={s.titleBlock}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
  const footer = (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{L.t('confidentiality')}</Text>
      {doc.watermark ? <Text style={s.footerMeta}>{L.t('trialMark')}</Text> : null}
      {/* A render-prop Text is only laid out reliably as a full-width child of a sized View. */}
      <Text style={s.footerMeta} render={({ pageNumber, totalPages }) => `${subtitle}   ·   ${L.t('page', { page: pageNumber, total: totalPages })}`} />
    </View>
  );

  return (
    <Document title={`${title} ${subtitle}`} subject={title} creator="DaktariScribe" producer="DaktariScribe" language={doc.lang}>
      {doc.aggregate && doc.summary ? (
        <Page size="A4" style={s.page} wrap>
          {/* Painted first so it sits behind the content. */}
          {doc.watermark ? <Text style={s.watermark} fixed>{L.t('trialMark')}</Text> : null}
          {header}
          <Text style={s.sectionHeading}>{L.t('summary')}</Text>
          <View style={s.summaryRow}>
            <View style={s.summaryCell}>
              <Text style={s.metaLabel}>{L.t('records')}</Text>
              <Text style={s.summaryValue}>{doc.summary.records}</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.metaLabel}>{L.t('sites')}</Text>
              <Text style={s.summaryValue}>{doc.summary.sites.length}</Text>
            </View>
            <View style={s.summaryCell}>
              <Text style={s.metaLabel}>{L.t('workers')}</Text>
              <Text style={s.summaryValue}>{doc.summary.workers}</Text>
            </View>
          </View>
          <Text style={s.line}>
            {L.t('period')}: {doc.summary.from ? formatDate(doc.summary.from, doc.lang) : '—'} – {doc.summary.to ? formatDate(doc.summary.to, doc.lang) : '—'}
          </Text>
          {(doc.metrics ?? []).map((m) => (
            <View key={m.fieldKey} wrap={false}>
              <Text style={s.sectionHeading}>{m.label}</Text>
              <View style={s.table}>
                {m.points.map((p, i) => (
                  <View key={p.label} style={i === m.points.length - 1 ? s.rowLast : s.row}>
                    <Text style={s.cellLabel}>{p.label}</Text>
                    <Text style={s.cellValue}>
                      {p.value}
                      {m.unit ? ` ${m.unit}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          <Text style={s.sectionHeading}>{L.t('followUpsDue')}</Text>
          {doc.followUps?.length ? (
            doc.followUps.map((f) => (
              <Text key={`${f.recordId}-${f.label}`} style={s.line}>
                {formatDate(f.date, doc.lang)} · {f.label} · {f.site} · {f.recordId}
              </Text>
            ))
          ) : (
            <Text style={s.empty}>{L.t('noFollowUps')}</Text>
          )}
          {footer}
        </Page>
      ) : null}
      {doc.records.map((rec) => (
        <Page key={rec.id} size="A4" style={s.page} wrap>
          {doc.watermark ? <Text style={s.watermark} fixed>{L.t('trialMark')}</Text> : null}
          {header}
          <RecordBlock rec={rec} doc={doc} s={s} />
          {footer}
        </Page>
      ))}
    </Document>
  );
}
