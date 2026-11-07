/**
 * Payment receipt, in the same "clinical ledger" style as the reports: navy spine with a teal
 * cap, hairline rules, the amount set large. Uses built-in Helvetica (receipts are English and
 * rendered without the report fonts).
 */
import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatUgx } from '@/lib/billing/plans';

const NAVY = '#001d3d';
const TEAL = '#006b5c';
const TEAL_SOFT = '#e3f4f0';
const INK = '#171c1f';
const MUTED = '#5b6069';
const FAINT = '#9aa0a8';
const HAIR = '#dde1e6';

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 60, paddingLeft: 64, paddingRight: 52, fontFamily: 'Helvetica', fontSize: 10, color: INK },
  spine: { position: 'absolute', top: 0, left: 0, width: 9, height: 841.89, backgroundColor: NAVY },
  spineCap: { position: 'absolute', top: 0, left: 0, width: 9, height: 128, backgroundColor: TEAL },
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 0.6, borderBottomColor: HAIR },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: NAVY },
  docType: { marginLeft: 'auto', fontFamily: 'Helvetica-Bold', fontSize: 7, color: NAVY, textTransform: 'uppercase' },
  eyebrow: { marginTop: 34, fontFamily: 'Helvetica-Bold', fontSize: 7, color: TEAL, textTransform: 'uppercase' },
  title: { marginTop: 6, fontFamily: 'Helvetica-Bold', fontSize: 24, color: NAVY },
  amountBlock: { marginTop: 26, paddingTop: 10, borderTopWidth: 2, borderTopColor: TEAL, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  amountLabel: { fontSize: 7, color: MUTED, textTransform: 'uppercase' },
  amount: { marginTop: 4, fontFamily: 'Helvetica-Bold', fontSize: 30, color: NAVY },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: TEAL_SOFT, borderRadius: 9, paddingVertical: 3, paddingHorizontal: 9 },
  pillDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: TEAL, marginRight: 5 },
  pillText: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: TEAL },
  rows: { marginTop: 26 },
  row: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: HAIR },
  label: { width: '42%', color: MUTED, fontSize: 9.5 },
  value: { width: '58%', fontFamily: 'Helvetica-Bold', fontSize: 9.8, textAlign: 'right' },
  note: { marginTop: 28, fontSize: 8.5, color: MUTED, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 26, left: 64, right: 52, paddingTop: 8, borderTopWidth: 0.6, borderTopColor: HAIR, fontSize: 7, color: FAINT },
});

export function ReceiptPdf(p: {
  reference: string;
  productName: string;
  amountUgx: number;
  paidAt: Date;
  method: string;
  phoneMasked: string | null;
  transactionId: string | null;
}) {
  const rows: [string, string][] = [
    ['Receipt reference', p.reference],
    ['Item', p.productName],
    ['Date paid', new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Kampala' }).format(p.paidAt)],
    ['Payment method', p.method === 'mobileMoney' ? 'Mobile money' : p.method === 'card' ? 'Card' : 'Bank transfer'],
    ...(p.phoneMasked ? ([['Phone', p.phoneMasked]] as [string, string][]) : []),
    ...(p.transactionId ? ([['Transaction ID', p.transactionId]] as [string, string][]) : []),
  ];
  return (
    <Document title={`Receipt ${p.reference}`} creator="DaktariScribe" producer="DaktariScribe">
      <Page size="A4" style={s.page}>
        <View style={s.spine} fixed />
        <View style={s.spineCap} fixed />
        <View style={s.header}>
          <Text style={s.brand}>DaktariScribe</Text>
          <Text style={s.docType}>Payment receipt</Text>
        </View>

        <Text style={s.eyebrow}>Receipt {p.reference.slice(0, 12)}</Text>
        <Text style={s.title}>Thank you for your payment</Text>

        <View style={s.amountBlock}>
          <View>
            <Text style={s.amountLabel}>Amount paid</Text>
            <Text style={s.amount}>{formatUgx(p.amountUgx)}</Text>
          </View>
          <View style={s.pill}>
            <View style={s.pillDot} />
            <Text style={s.pillText}>PAID</Text>
          </View>
        </View>

        <View style={s.rows}>
          {rows.map(([k, v]) => (
            <View key={k} style={s.row}>
              <Text style={s.label}>{k}</Text>
              <Text style={s.value}>{v}</Text>
            </View>
          ))}
        </View>

        <Text style={s.note}>Prepaid pass. It does not renew automatically. Payments are processed by Nylon Pay. Keep this receipt for your records.</Text>
        <Text style={s.footer} fixed>
          DaktariScribe · Clinical documentation for frontline health teams
        </Text>
      </Page>
    </Document>
  );
}
