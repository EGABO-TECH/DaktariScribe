/**
 * Branded PDF report (spec §5 Phase 1.6 / 5.1, DESIGN.md §8) for one or many Final records.
 * Rendered on the server and, for offline drafts, in the browser with the same component.
 *
 * Design: a quiet "clinical ledger". A navy spine with a teal cap runs down the left edge of every
 * page (the DaktariScribe signature); no boxes, only hairline rules; numbered sections; values
 * aligned in a single reading column; a formal sign-off block.
 *
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

/* Palette (DESIGN.md §1) */
const NAVY = '#001d3d';
const TEAL = '#006b5c';
const TEAL_SOFT = '#e3f4f0';
const INK = '#171c1f';
const MUTED = '#5b6069';
const FAINT = '#9aa0a8';
const HAIR = '#dde1e6';
const AMBER = '#9a4a07';
const AMBER_SOFT = '#fdf3e1';

const A4_HEIGHT = 841.89;

function familyFor(lang: string, fontsRegistered: boolean) {
  if (!fontsRegistered) return { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' };
  if (lang === 'amh') return { regular: 'NotoSansEthiopic', bold: 'NotoSansEthiopic', italic: 'NotoSansEthiopic' };
  if (lang === 'ara') return { regular: 'NotoSansArabic', bold: 'NotoSansArabic', italic: 'NotoSansArabic' };
  return { regular: 'NotoSans', bold: 'NotoSans', italic: 'NotoSans' };
}

function makeStyles(fam: ReturnType<typeof familyFor>, noto: boolean) {
  const latinNoto = noto && fam.regular === 'NotoSans';
  const bold = latinNoto ? { fontFamily: fam.bold, fontWeight: 'bold' as const } : { fontFamily: fam.bold };
  const italic = latinNoto ? { fontFamily: fam.italic, fontStyle: 'italic' as const } : { fontFamily: fam.italic };
  // No letterSpacing anywhere: it splits extracted text into single letters ("C L I N I C A L"),
  // which breaks search, copy and screen readers.
  const caps = { fontSize: 6.8, color: MUTED, textTransform: 'uppercase' as const };
  return StyleSheet.create({
    page: { paddingTop: 30, paddingBottom: 74, paddingLeft: 60, paddingRight: 46, fontFamily: fam.regular, fontSize: 9.5, color: INK },

    /* Signature spine */
    spine: { position: 'absolute', top: 0, left: 0, width: 9, height: A4_HEIGHT, backgroundColor: NAVY },
    spineCap: { position: 'absolute', top: 0, left: 0, width: 9, height: 128, backgroundColor: TEAL },

    /* Running header */
    header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 9, marginBottom: 22, borderBottomWidth: 0.6, borderBottomColor: HAIR },
    logo: { width: 18, height: 18, marginRight: 7 },
    wordmark: { ...bold, fontSize: 9.5, color: NAVY },
    org: { fontSize: 8, color: MUTED, marginLeft: 6 },
    docType: { ...caps, ...bold, marginLeft: 'auto', color: NAVY },

    /* Title block */
    eyebrow: { ...caps, ...bold, color: TEAL, marginBottom: 6 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    title: { ...bold, fontSize: 22, color: NAVY, lineHeight: 1.15, maxWidth: 330 },
    subtitle: { fontSize: 10.5, color: MUTED, marginTop: 5 },
    statusCol: { alignItems: 'flex-end', marginLeft: 16 },
    pill: { flexDirection: 'row', alignItems: 'center', borderRadius: 9, paddingVertical: 3, paddingHorizontal: 8 },
    pillDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
    pillText: { ...bold, fontSize: 7.5 },
    recordId: { fontSize: 7.5, color: MUTED, marginTop: 6 },

    /* Meta ledger */
    meta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, marginBottom: 8, paddingTop: 10, borderTopWidth: 0.6, borderTopColor: HAIR, borderBottomWidth: 0.6, borderBottomColor: HAIR },
    metaCell: { width: '25%', paddingRight: 10, paddingBottom: 10 },
    metaLabel: { ...caps, marginBottom: 3 },
    metaValue: { fontSize: 9, color: INK },

    note: { marginTop: 12, fontSize: 8.5, color: AMBER, backgroundColor: AMBER_SOFT, paddingVertical: 6, paddingHorizontal: 8, borderLeftWidth: 2, borderLeftColor: AMBER },

    /* Sections */
    section: { marginTop: 20 },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', paddingBottom: 5, marginBottom: 8, borderBottomWidth: 0.6, borderBottomColor: HAIR },
    sectionNo: { ...bold, fontSize: 8.5, color: TEAL, width: 22 },
    sectionTitle: { ...bold, fontSize: 11.5, color: NAVY },
    para: { fontSize: 9.8, lineHeight: 1.6, marginBottom: 6, paddingLeft: 22 },
    empty: { ...italic, fontSize: 9, color: FAINT, paddingLeft: 22 },

    fieldRow: { flexDirection: 'row', paddingVertical: 5.5, marginLeft: 22, borderBottomWidth: 0.4, borderBottomColor: HAIR },
    fieldRowLast: { flexDirection: 'row', paddingVertical: 5.5, marginLeft: 22 },
    fieldLabel: { width: '55%', fontSize: 9.2, color: MUTED },
    fieldValue: { ...bold, width: '45%', fontSize: 9.4, color: INK, textAlign: 'right' },
    fieldEmpty: { ...italic, width: '45%', fontSize: 8.8, color: FAINT, textAlign: 'right' },

    /* Sign-off */
    signoff: { marginTop: 24 },
    quote: { ...italic, fontSize: 9.5, lineHeight: 1.55, color: INK, borderLeftWidth: 2, borderLeftColor: TEAL, paddingLeft: 10, marginLeft: 22, marginBottom: 14 },
    sigGrid: { flexDirection: 'row', marginLeft: 22 },
    sigCol: { width: '50%', paddingRight: 18 },
    sigValue: { ...bold, fontSize: 10, color: INK, marginTop: 2 },
    sigLine: { borderBottomWidth: 0.8, borderBottomColor: INK, height: 26 },
    sigSpacer: { height: 16 },
    provenance: { fontSize: 7.8, color: MUTED, lineHeight: 1.5, marginTop: 18, paddingTop: 8, borderTopWidth: 0.6, borderTopColor: HAIR },

    /* Appendix */
    appendixLabel: { ...caps, ...bold, color: TEAL, marginTop: 6, marginBottom: 4, paddingLeft: 22 },
    appendixText: { fontSize: 9, lineHeight: 1.55, color: INK, paddingLeft: 22, marginBottom: 8 },

    /* Summary (aggregate) */
    stats: { flexDirection: 'row', marginTop: 20, marginBottom: 6 },
    stat: { flexGrow: 1, flexBasis: 0, marginRight: 14, paddingTop: 8, borderTopWidth: 2, borderTopColor: TEAL },
    statValue: { ...bold, fontSize: 24, color: NAVY, lineHeight: 1.1 },
    statLabel: { ...caps, marginTop: 4 },

    /* Running footer */
    footer: { position: 'absolute', bottom: 22, left: 60, right: 46, height: 40, paddingTop: 7, borderTopWidth: 0.6, borderTopColor: HAIR },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    footerText: { fontSize: 6.3, color: FAINT, lineHeight: 1.4, width: '72%' },
    footerMeta: { ...bold, fontSize: 7, color: MUTED, textAlign: 'right', width: '28%' },
    footerTrial: { ...bold, fontSize: 6.5, color: AMBER, marginTop: 3 },
    watermark: { position: 'absolute', top: 400, left: 0, right: 0, height: 60, textAlign: 'center', fontSize: 46, color: '#f1f3f5', transform: 'rotate(-30deg)' },
  });
}

type S = ReturnType<typeof makeStyles>;

const pad2 = (n: number) => String(n).padStart(2, '0');

function SectionHead({ no, title, s }: { no: number; title: string; s: S }) {
  return (
    <View style={s.sectionHead} minPresenceAhead={40}>
      <Text style={s.sectionNo}>{pad2(no)}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function StatusPill({ signed, draft, doc, s }: { signed: boolean; draft: boolean; doc: ExportDoc; s: S }) {
  const L = doc.labels;
  const final = signed && !draft;
  return (
    <View style={[s.pill, { backgroundColor: final ? TEAL_SOFT : AMBER_SOFT }]}>
      <View style={[s.pillDot, { backgroundColor: final ? TEAL : AMBER }]} />
      <Text style={[s.pillText, { color: final ? TEAL : AMBER }]}>{(final ? L.t('statusFinal') : L.t('statusDraft')).toUpperCase()}</Text>
    </View>
  );
}

function RecordBlock({ rec, doc, s, draft }: { rec: ExportRecord; doc: ExportDoc; s: S; draft: boolean }) {
  const L = doc.labels;
  const meta: [string, string][] = [
    [L.t('encounterDate'), formatDate(rec.encounterDate, doc.lang)],
    [L.t('site'), rec.site],
    [L.t('author'), rec.workerName],
    [L.t('interviewLanguage'), rec.interviewLanguage],
    [L.t('template'), `${rec.templateName} · v${rec.templateVersion}`],
    [L.t('respondentRef'), rec.respondentRef || L.t('notRecorded')],
    [L.t('consentObtained'), rec.consentObtained ? L.t('yes') : L.t('no')],
    [L.t('version'), rec.versionNo ? `v${rec.versionNo}` : '—'],
  ];
  // Section numbers, worked out up front: content sections, then codes, sign-off, appendix.
  const codesNo = rec.sections.length + 1;
  const signoffNo = codesNo + (rec.codes.length ? 1 : 0);
  const appendixNo = signoffNo + 1;
  return (
    <View>
      {/* Title block */}
      <Text style={s.eyebrow}>
        {L.t('recordId')} {rec.id}
      </Text>
      <View style={s.titleRow}>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.title}>{rec.templateName}</Text>
          <Text style={s.subtitle}>
            {rec.site} · {formatDate(rec.encounterDate, doc.lang)}
          </Text>
        </View>
        <View style={s.statusCol}>
          <StatusPill signed={Boolean(rec.signoff)} draft={draft} doc={doc} s={s} />
          {rec.versionNo ? <Text style={s.recordId}>{`${L.t('version')} ${rec.versionNo}`}</Text> : null}
        </View>
      </View>

      <View style={s.meta}>
        {meta.map(([label, value]) => (
          <View key={label} style={s.metaCell}>
            <Text style={s.metaLabel}>{label}</Text>
            <Text style={s.metaValue}>{value}</Text>
          </View>
        ))}
      </View>
      {rec.translationNote ? <Text style={s.note}>{rec.translationNote}</Text> : null}

      {/* Content */}
      {rec.sections.map((sec, idx) => {
        return (
          <View key={sec.key} style={s.section} wrap={sec.fields.length > 12 || sec.lines.length > 6}>
            <SectionHead no={idx + 1} title={sec.label} s={s} />
            {sec.lines.map((l, i) => (
              <Text key={i} style={s.para}>
                {l}
              </Text>
            ))}
            {!sec.lines.length && !sec.fields.length ? <Text style={s.empty}>{L.t('notRecorded')}</Text> : null}
            {sec.fields.map((f, i) => (
              <View key={f.key} style={i === sec.fields.length - 1 ? s.fieldRowLast : s.fieldRow} wrap={false}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                {f.value !== null ? <Text style={s.fieldValue}>{f.value}</Text> : <Text style={s.fieldEmpty}>{L.t('notRecorded')}</Text>}
              </View>
            ))}
          </View>
        );
      })}

      {rec.codes.length ? (
        <View style={s.section}>
          <SectionHead no={codesNo} title={L.t('suggestedCodes')} s={s} />
          {rec.codes.map((c) => (
            <Text key={c} style={s.para}>
              {c}
            </Text>
          ))}
        </View>
      ) : null}

      {/* Sign-off */}
      <View style={s.signoff} wrap={false}>
        <SectionHead no={signoffNo} title={L.t('signoffTitle')} s={s} />
        {rec.signoff ? (
          <>
            <Text style={s.quote}>{rec.signoff.statement}</Text>
            <View style={s.sigGrid}>
              <View style={s.sigCol}>
                <Text style={s.metaLabel}>{L.t('signedOffBy')}</Text>
                <Text style={s.sigValue}>{rec.signoff.name}</Text>
              </View>
              <View style={s.sigCol}>
                <Text style={s.metaLabel}>{L.t('dateTime')}</Text>
                <Text style={s.sigValue}>{formatDate(rec.signoff.at, doc.lang, true)}</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={s.empty}>{L.t('notSignedOff')}</Text>
        )}
        <View style={s.sigSpacer} />
        <View style={s.sigGrid}>
          <View style={s.sigCol}>
            <View style={s.sigLine} />
            <Text style={[s.metaLabel, { marginTop: 4 }]}>{L.t('signature')}</Text>
          </View>
          <View style={s.sigCol}>
            <View style={s.sigLine} />
            <Text style={[s.metaLabel, { marginTop: 4 }]}>{L.t('stamp')}</Text>
          </View>
        </View>
        <Text style={s.provenance}>
          {provenance(rec, L)} {L.t('exported', { date: formatDate(doc.exportedAt, doc.lang, true) })}
        </Text>
      </View>

      {rec.originals?.length ? (
        <View style={{ marginTop: 28 }}>
          <SectionHead no={appendixNo} title={L.t('appendixTranscript')} s={s} />
          {rec.originals.map((o, i) => (
            <View key={i}>
              <Text style={s.appendixLabel}>{o.label}</Text>
              <Text style={s.appendixText}>{o.text.replace(/\n{3,}/g, '\n\n')}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export type ReportPdfProps = { doc: ExportDoc; logoSrc?: Buffer | string; fontsRegistered?: boolean; /** Offline draft: marked as not signed off. */ draft?: boolean };

export function ReportPdf({ doc, logoSrc, fontsRegistered = false, draft = false }: ReportPdfProps) {
  const fam = familyFor(doc.lang, fontsRegistered);
  const s = makeStyles(fam, fontsRegistered);
  const L = doc.labels;
  const title = doc.aggregate ? L.t('aggregateTitle') : L.t('reportTitle');
  const ref = doc.aggregate ? `${doc.records.length} ${L.t('records').toLowerCase()}` : (doc.records[0]?.id ?? '');

  const chrome = (
    <>
      {/* Painted first so they sit behind the content. */}
      <View style={s.spine} fixed />
      <View style={s.spineCap} fixed />
      {doc.watermark ? (
        <Text style={s.watermark} fixed>
          {L.t('trialMark')}
        </Text>
      ) : null}
      <View style={s.header} fixed>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
        {logoSrc ? <Image src={logoSrc} style={s.logo} /> : null}
        <Text style={s.wordmark}>DaktariScribe</Text>
        {doc.orgName ? <Text style={s.org}>{doc.orgName}</Text> : null}
        <Text style={s.docType}>{title}</Text>
      </View>
    </>
  );

  const footer = (
    <View style={s.footer} fixed>
      <View style={s.footerRow}>
        <View style={{ width: '72%' }}>
          <Text style={s.footerText}>{L.t('confidentiality')}</Text>
          {doc.watermark ? <Text style={s.footerTrial}>{L.t('trialMark')}</Text> : null}
        </View>
        {/* A render-prop Text is only laid out reliably inside a sized View. */}
        <Text style={s.footerMeta} render={({ pageNumber, totalPages }) => `${ref}\n${L.t('page', { page: pageNumber, total: totalPages })}`} />
      </View>
    </View>
  );

  return (
    <Document title={`${title} ${ref}`} subject={title} creator="DaktariScribe" producer="DaktariScribe" language={doc.lang}>
      {doc.aggregate && doc.summary ? (
        <Page size="A4" style={s.page} wrap>
          {chrome}
          <Text style={s.eyebrow}>{doc.orgName || 'DaktariScribe'}</Text>
          <Text style={[s.title, { maxWidth: 480 }]}>{L.t('aggregateTitle')}</Text>
          <Text style={s.subtitle}>
            {L.t('period')}: {doc.summary.from ? formatDate(doc.summary.from, doc.lang) : '—'} – {doc.summary.to ? formatDate(doc.summary.to, doc.lang) : '—'}
          </Text>
          <View style={s.stats}>
            {(
              [
                [L.t('records'), doc.summary.records],
                [L.t('sites'), doc.summary.sites.length],
                [L.t('workers'), doc.summary.workers],
                [L.t('followUpsDue'), doc.followUps?.length ?? 0],
              ] as const
            ).map(([label, value], i, all) => (
              <View key={label} style={[s.stat, i === all.length - 1 ? { marginRight: 0 } : {}]}>
                <Text style={s.statValue}>{value}</Text>
                <Text style={s.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {doc.summary.sites.length ? (
            <Text style={[s.subtitle, { fontSize: 8.5 }]}>
              {L.t('sites')}: {doc.summary.sites.join(', ')}
            </Text>
          ) : null}

          {(doc.metrics ?? []).map((m, idx) => (
            <View key={m.fieldKey} style={s.section} wrap={false}>
              <SectionHead no={idx + 1} title={m.label} s={s} />
              {m.points.map((p, i) => (
                <View key={p.label} style={i === m.points.length - 1 ? s.fieldRowLast : s.fieldRow}>
                  <Text style={s.fieldLabel}>{p.label}</Text>
                  <Text style={s.fieldValue}>
                    {p.value}
                    {m.unit ? ` ${m.unit}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          ))}

          <View style={s.section}>
            <SectionHead no={(doc.metrics?.length ?? 0) + 1} title={L.t('followUpsDue')} s={s} />
            {doc.followUps?.length ? (
              doc.followUps.map((f) => (
                <View key={`${f.recordId}-${f.label}`} style={s.fieldRow} wrap={false}>
                  <Text style={s.fieldLabel}>
                    {f.label} · {f.site}
                  </Text>
                  <Text style={s.fieldValue}>{formatDate(f.date, doc.lang)}</Text>
                </View>
              ))
            ) : (
              <Text style={s.empty}>{L.t('noFollowUps')}</Text>
            )}
          </View>
          {footer}
        </Page>
      ) : null}
      {doc.records.map((rec) => (
        <Page key={rec.id} size="A4" style={s.page} wrap>
          {chrome}
          <RecordBlock rec={rec} doc={doc} s={s} draft={draft} />
          {footer}
        </Page>
      ))}
    </Document>
  );
}
