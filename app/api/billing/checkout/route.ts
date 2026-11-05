import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@clerk/nextjs/server';
import { getDb, schema } from '@/db';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { encryptString } from '@/lib/crypto';
import { newId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { limit } from '@/lib/ratelimit';
import { getActivePass } from '@/lib/billing/entitlements';
import { createHostedInvoice, nylonPayConfigured, startMobileMoneyCollection } from '@/lib/billing/nylonpay';
import { PURCHASABLE, priceFor, product, NYLONPAY_MIN_UGX, type PurchasableCode } from '@/lib/billing/plans';
import { maskPhone, normaliseUgPhone } from '@/lib/billing/rules';

const body = z.object({
  productCode: z.enum(PURCHASABLE as [PurchasableCode, ...PurchasableCode[]]),
  method: z.enum(['mobileMoney', 'card']),
  phone: z.string().max(20).optional(),
  seats: z.number().int().min(5).max(500).optional(),
});

/**
 * POST /api/billing/checkout — starts a payment. The amount always comes from lib/billing/plans,
 * never from the client. Mobile money: sends the PIN prompt to the phone. Card/bank: returns a
 * hosted payment page URL (card details never touch this server).
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireAuth();
    if (!nylonPayConfigured()) return NextResponse.json({ error: 'Payments are not set up yet.' }, { status: 503 });
    await limit('checkout', ctx.userId);
    const input = body.parse(await request.json().catch(() => null));
    const prod = product(input.productCode);

    if (prod.kind === 'topup' && !(await getActivePass(ctx.userId, ctx.orgId))) {
      return NextResponse.json({ error: 'Top-ups need an active pass. Buy a pass first.' }, { status: 409 });
    }
    if (input.productCode === 'team_seat' && (ctx.orgId.startsWith('personal_') || ctx.role !== 'admin')) {
      return NextResponse.json({ error: 'Only an organisation admin can buy team seats.' }, { status: 403 });
    }

    const seats = input.productCode === 'team_seat' ? (input.seats ?? 5) : null;
    const amount = priceFor(input.productCode, seats ?? 1);
    if (amount < NYLONPAY_MIN_UGX) return NextResponse.json({ error: 'Amount below the payment minimum.' }, { status: 400 });

    const user = await currentUser();
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'DaktariScribe user';
    const reference = crypto.randomUUID(); // must be a UUID for Nylon Pay
    const description = `DaktariScribe ${prod.name}${seats ? ` × ${seats} seats` : ''}`;
    const db = getDb();

    if (input.method === 'mobileMoney') {
      const phone = normaliseUgPhone(input.phone ?? '');
      if (!phone) return NextResponse.json({ error: 'Enter an MTN or Airtel Uganda number, e.g. 0772 123456.' }, { status: 400 });
      await db.insert(schema.payment).values({
        id: newId(),
        userId: ctx.userId,
        orgId: seats ? ctx.orgId : null,
        reference,
        productCode: input.productCode,
        amountUgx: amount,
        method: 'mobileMoney',
        phoneMasked: maskPhone(phone),
        seats,
      });
      await db
        .insert(schema.billingProfile)
        .values({ userId: ctx.userId, phone: encryptString(phone), phoneMasked: maskPhone(phone) })
        .onConflictDoUpdate({ target: schema.billingProfile.userId, set: { phone: encryptString(phone), phoneMasked: maskPhone(phone) } });
      try {
        await startMobileMoneyCollection({ amount, reference, name, phone, description });
      } catch (err) {
        logger.error('checkout.collect_failed', { reference, err });
        await db.update(schema.payment).set({ status: 'failed' }).where((await import('drizzle-orm')).eq(schema.payment.reference, reference));
        return NextResponse.json({ error: 'The payment could not be started. Check the number and try again.' }, { status: 502 });
      }
      return NextResponse.json({ reference, method: 'mobileMoney', amountUgx: amount });
    }

    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) return NextResponse.json({ error: 'Add an email address to your account to pay by card.' }, { status: 400 });
    const invoice = await createHostedInvoice({
      amount,
      reference,
      email,
      name,
      description,
      itemName: prod.name,
      quantity: seats ?? 1,
      unitPrice: seats ? prod.priceUgx : amount,
    });
    await db.insert(schema.payment).values({
      id: newId(),
      userId: ctx.userId,
      orgId: seats ? ctx.orgId : null,
      reference,
      productCode: input.productCode,
      amountUgx: amount,
      method: 'card',
      providerInvoiceId: invoice.id,
      invoiceUrl: invoice.url,
      seats,
    });
    return NextResponse.json({ reference, method: 'card', url: invoice.url, amountUgx: amount });
  } catch (err) {
    return errorResponse(err, 'billing.checkout');
  }
}
