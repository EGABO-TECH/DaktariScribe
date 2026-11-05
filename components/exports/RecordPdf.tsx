/**
 * Branded single-record PDF (spec §5 Phase 1.6). Rendered on the server with
 * @react-pdf/renderer; Phase 4 reuses the same component in the browser for offline drafts.
 *
 * Every page carries the confidentiality notice and page numbers. Empty fields print
 * "Not recorded". Nothing in the output says "generated".
 */
import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { RecordDetail } from '@/lib/records/service';
import { labelFor } from '@/lib/templates/definition';
import { NOTES_SECTION_KEY } from '@/lib/records/refined-record';
import { languageName } from '@/lib/records/languages';
import { formatFieldValue } from '@/lib/records/format';

export const CONFIDENTIALITY_NOTICE =
  'CONFIDENTIAL. This report contains personal health information and is intended only for authorised health personnel. Do not share, copy or disclose without authorisation.';

const NAVY = '#001d3d';
const TEAL = '#006b5c';
const INK = '#171c1f';
const MUTED = '#43474f';
const RULE = '#c3c6d0';
const SOFT = '#f0f4f7';

const s = StyleSheet.create({
  // No lineHeight here: a page-level lineHeight stops react-pdf 4.x drawing render-prop Text (page numbers).
  page: { paddingTop: 40, paddingBottom: 76, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 10, color: INK },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 10, marginBottom: 14 },
  logo: { width: 34, height: 34, marginRight: 10 },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: NAVY },
  org: { fontSize: 8.5, color: MUTED },
  titleBlock: { marginLeft: 'auto', alignItems: 'flex-end' },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: NAVY },
  subtitle: { fontSize: 9, color: MUTED },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: RULE, marginBottom: 16 },
  metaCell: { width: '33.33%', padding: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: RULE },
  metaLabel: { fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  metaValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK },
  sectionHeading: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    color: NAVY,
    backgroundColor: SOFT,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
  },
  line: { marginBottom: 5, paddingHorizontal: 6, lineHeight: 1.45 },
  empty: { color: MUTED, fontStyle: 'italic', paddingHorizontal: 6, lineHeight: 1.45 },
  table: { borderWidth: 1, borderColor: RULE, marginBottom: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: RULE },
  rowLast: { flexDirection: 'row' },
  cellLabel: { width: '45%', padding: 5, borderRightWidth: 1, borderRightColor: RULE, color: MUTED },
  cellValue: { width: '55%', padding: 5, fontFamily: 'Helvetica-Bold' },
  notRecorded: { width: '55%', padding: 5, color: MUTED, fontStyle: 'italic' },
  signature: { marginTop: 20, borderWidth: 1, borderColor: NAVY, padding: 10 },
  sigTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: NAVY, marginBottom: 6 },
  sigRow: { flexDirection: 'row', marginTop: 12 },
  sigCol: { width: '50%' },
  sigLine: { borderBottomWidth: 1, borderBottomColor: INK, height: 18, marginRight: 16 },
  provenance: { marginTop: 12, fontSize: 8.5, color: MUTED, lineHeight: 1.45 },
  // react-pdf 4.x drops a bottom-anchored absolute View without an explicit height, and drops
  // children that overflow that height, so keep the height generous for the footer contents.
  footer: { position: 'absolute', bottom: 16, left: 44, right: 44, height: 50, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 6 },
  footerText: { fontSize: 7, color: MUTED, lineHeight: 1.35 },
  // No lineHeight: react-pdf 4.x does not draw a render-prop Text that has one.
  footerMeta: { fontSize: 7.5, color: MUTED, marginTop: 4, fontFamily: 'Helvetica-Bold' },
});

function fmtDate(d: Date | string, withTime = false): string {
  const date = typeof d === 'string' ? new Date(`${d}T00:00:00Z`) : d;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } : {}),
    timeZone: withTime ? 'Africa/Kampala' : 'UTC',
  }).format(date);
}

export type RecordPdfProps = {
  record: RecordDetail;
  orgName: string;
  logoSrc?: Buffer | string;
  exportedAt?: Date;
};

export function RecordPdf({ record, orgName, logoSrc, exportedAt = new Date() }: RecordPdfProps) {
  const def = record.template.definition;
  const content = record.currentVersion?.content;
  const linesBySection = new Map((content?.sections ?? []).map((sec) => [sec.key, sec.lines]));
  const fieldValues = new Map((content?.fields ?? []).map((f) => [f.key, f]));
  const notes = linesBySection.get(NOTES_SECTION_KEY) ?? [];

  const meta: [string, string][] = [
    ['Record ID', record.id],
    ['Encounter date', fmtDate(record.encounterDate)],
    ['Site', record.site],
    ['Author', record.workerName],
    ['Template', `${record.template.name} (v${record.template.version})`],
    ['Interview language', languageName(record.interviewLanguage)],
    ['Respondent ref.', record.respondentRef || 'Not recorded'],
    ['Consent obtained', record.consentObtained ? 'Yes' : 'No'],
    ['Version', record.currentVersion ? `v${record.currentVersion.versionNo}` : '—'],
  ];

  return (
    <Document title={`Field report ${record.id}`} author={record.workerName} subject="Clinical field report" creator="DaktariScribe" producer="DaktariScribe">
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
          {logoSrc ? <Image src={logoSrc} style={s.logo} /> : null}
          <View>
            <Text style={s.brand}>DaktariScribe</Text>
            <Text style={s.org}>{orgName}</Text>
          </View>
          <View style={s.titleBlock}>
            <Text style={s.title}>Clinical Field Report</Text>
            <Text style={s.subtitle}>{record.id}</Text>
          </View>
        </View>

        <View style={s.metaGrid}>
          {meta.map(([label, value]) => (
            <View key={label} style={s.metaCell}>
              <Text style={s.metaLabel}>{label}</Text>
              <Text style={s.metaValue}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionHeading}>Clinical notes</Text>
        {notes.length ? (
          notes.map((l, i) => (
            <Text key={i} style={s.line}>
              {l.text}
            </Text>
          ))
        ) : (
          <Text style={s.empty}>Not recorded</Text>
        )}

        {def.sections.map((sec) => {
          const lines = linesBySection.get(sec.key) ?? [];
          if (!sec.fields.length && !lines.length) return null;
          return (
            <View key={sec.key} wrap={false}>
              <Text style={s.sectionHeading}>{labelFor(sec.label)}</Text>
              {lines.map((l, i) => (
                <Text key={i} style={s.line}>
                  {l.text}
                </Text>
              ))}
              {sec.fields.length ? (
                <View style={s.table}>
                  {sec.fields.map((f, i) => {
                    const v = fieldValues.get(f.key);
                    const recorded = v && v.status === 'recorded' && v.value !== null && v.value !== '';
                    return (
                      <View key={f.key} style={i === sec.fields.length - 1 ? s.rowLast : s.row}>
                        <Text style={s.cellLabel}>{labelFor(f.label)}</Text>
                        {recorded ? (
                          <Text style={s.cellValue}>{formatFieldValue(f, v.value)}</Text>
                        ) : (
                          <Text style={s.notRecorded}>Not recorded</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={s.signature} wrap={false}>
          <Text style={s.sigTitle}>Clinician sign-off</Text>
          {record.signoff ? (
            <>
              <Text>{record.signoff.statement}</Text>
              <View style={s.sigRow}>
                <View style={s.sigCol}>
                  <Text style={s.metaLabel}>Signed off by</Text>
                  <Text style={s.metaValue}>{record.signoff.signerName}</Text>
                </View>
                <View style={s.sigCol}>
                  <Text style={s.metaLabel}>Date and time</Text>
                  <Text style={s.metaValue}>{fmtDate(record.signoff.signedAt, true)}</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={s.empty}>Not signed off.</Text>
          )}
          <View style={s.sigRow}>
            <View style={s.sigCol}>
              <Text style={s.metaLabel}>Signature</Text>
              <View style={s.sigLine} />
            </View>
            <View style={s.sigCol}>
              <Text style={s.metaLabel}>Stamp / registration no.</Text>
              <View style={s.sigLine} />
            </View>
          </View>
        </View>

        <Text style={s.provenance}>
          Prepared from original field notes captured by {record.workerName} on {fmtDate(record.encounterDate)}. Exported{' '}
          {fmtDate(exportedAt, true)}.
        </Text>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{CONFIDENTIALITY_NOTICE}</Text>
          {/* A render-prop Text is only laid out reliably as a full-width child of a sized View. */}
          <Text style={s.footerMeta} render={({ pageNumber, totalPages }) => `${record.id}   ·   Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
