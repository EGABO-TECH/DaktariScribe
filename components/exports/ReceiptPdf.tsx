import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatUgx } from '@/lib/billing/plans';

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', fontSize: 11, color: '#171c1f' },
  brand: { fontFamily: 'Helvetica-Bold', fontSize: 16, color: '#001d3d' },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 20, color: '#001d3d', marginTop: 24, marginBottom: 16 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#c3c6d0', paddingVertical: 8 },
  label: { width: '40%', color: '#43474f' },
  value: { width: '60%', fontFamily: 'Helvetica-Bold' },
  note: { marginTop: 24, fontSize: 9, color: '#43474f' },
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
    ['Amount paid', formatUgx(p.amountUgx)],
    ['Date', new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Kampala' }).format(p.paidAt)],
    ['Method', p.method === 'mobileMoney' ? 'Mobile money' : p.method === 'card' ? 'Card' : 'Bank transfer'],
    ...(p.phoneMasked ? ([['Phone', p.phoneMasked]] as [string, string][]) : []),
    ...(p.transactionId ? ([['Transaction ID', p.transactionId]] as [string, string][]) : []),
  ];
  return (
    <Document title={`Receipt ${p.reference}`} creator="DaktariScribe" producer="DaktariScribe">
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>DaktariScribe</Text>
        <Text style={s.title}>Payment receipt</Text>
        {rows.map(([k, v]) => (
          <View key={k} style={s.row}>
            <Text style={s.label}>{k}</Text>
            <Text style={s.value}>{v}</Text>
          </View>
        ))}
        <Text style={s.note}>Prepaid pass. It does not renew automatically. Payments processed by Nylon Pay.</Text>
      </Page>
    </Document>
  );
}
