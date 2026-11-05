import { NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { NotFoundError } from '@/lib/records/service';
import { getPaymentForUser } from '@/lib/billing/payments';
import { product, type ProductCode } from '@/lib/billing/plans';
import { ReceiptPdf } from '@/components/exports/ReceiptPdf';

export const runtime = 'nodejs';

/** GET /api/billing/receipts/:reference — PDF receipt for a successful payment. */
export async function GET(_request: Request, ctx: RouteContext<'/api/billing/receipts/[reference]'>) {
  const { reference } = await ctx.params;
  try {
    const auth = await requireAuth();
    const p = await getPaymentForUser(reference, auth.userId);
    if (!p || p.status !== 'successful') throw new NotFoundError();
    const pdf = await renderToBuffer(
      React.createElement(ReceiptPdf, {
        reference: p.reference,
        productName: product(p.productCode as ProductCode).name + (p.seats ? ` × ${p.seats} seats` : ''),
        amountUgx: p.amountUgx,
        paidAt: p.settledAt ?? p.updatedAt,
        method: p.method,
        phoneMasked: p.phoneMasked,
        transactionId: p.providerTransactionId,
      }) as Parameters<typeof renderToBuffer>[0],
    );
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DaktariScribe-receipt-${reference.slice(0, 8)}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return errorResponse(err, 'billing.receipt');
  }
}
