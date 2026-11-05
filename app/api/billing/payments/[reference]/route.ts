import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { NotFoundError } from '@/lib/records/service';
import { fetchStatus } from '@/lib/billing/nylonpay';
import { applyProviderStatus, getPaymentForUser } from '@/lib/billing/payments';

/**
 * GET /api/billing/payments/:reference — polled by the "Check your phone" screen.
 * If no webhook has arrived yet, asks Nylon Pay directly (getStatus) and applies the result.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/billing/payments/[reference]'>) {
  const { reference } = await ctx.params;
  try {
    const auth = await requireAuth();
    let p = await getPaymentForUser(reference, auth.userId);
    if (!p) throw new NotFoundError();
    if (p.status === 'pending' || p.status === 'processing') {
      const s = await fetchStatus(reference).catch(() => null);
      if (s) {
        await applyProviderStatus(reference, s.status, s.id);
        p = (await getPaymentForUser(reference, auth.userId))!;
      }
    }
    return NextResponse.json(
      { reference: p.reference, status: p.status, productCode: p.productCode, amountUgx: p.amountUgx, invoiceUrl: p.invoiceUrl },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return errorResponse(err, 'billing.payment_status');
  }
}
