import { NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { logger } from '@/lib/logger';
import { verifySignature, type WebhookPayload } from '@/lib/billing/nylonpay';
import { applyProviderStatus } from '@/lib/billing/payments';

export const runtime = 'nodejs';

/**
 * POST /api/webhooks/nylonpay (spec §7.3).
 * - Verifies the signature over the RAW body (header x-nylon-signature, freshness checked by the SDK).
 * - Idempotent: each delivery_id is recorded once; repeats are acknowledged and ignored.
 *   Pass activation itself is also exactly-once (locked transaction keyed on the reference).
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get('x-nylon-signature');
  if (!verifySignature(raw, signature)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let event: WebhookPayload;
  try {
    event = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Bad payload' }, { status: 400 });
  }
  const reference = event.payload?.reference;
  if (!event.delivery_id || !reference) return NextResponse.json({ error: 'Bad payload' }, { status: 400 });

  const inserted = await getDb()
    .insert(schema.webhookDelivery)
    .values({ id: event.delivery_id, provider: 'nylonpay', event: event.event, reference })
    .onConflictDoNothing()
    .returning({ id: schema.webhookDelivery.id });
  if (!inserted.length) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const status =
      event.event === 'transaction.successful'
        ? 'successful'
        : event.event === 'transaction.failed'
          ? 'failed'
          : event.event === 'transaction.cancelled'
            ? 'cancelled'
            : 'processing';
    const result = await applyProviderStatus(reference, status, event.payload.transactionId);
    logger.info('webhook.nylonpay', { event: event.event, reference, result });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Let the provider retry: forget this delivery so the retry is processed.
    const { eq } = await import('drizzle-orm');
    await getDb().delete(schema.webhookDelivery).where(eq(schema.webhookDelivery.id, event.delivery_id));
    logger.error('webhook.nylonpay_failed', { reference, err });
    return NextResponse.json({ error: 'Temporary error' }, { status: 500 });
  }
}
