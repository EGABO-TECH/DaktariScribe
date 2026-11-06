import { NextResponse, type NextRequest } from 'next/server';
import { verifyWebhook, type WebhookEvent } from '@clerk/nextjs/webhooks';
import { isDatabaseConfigured } from '@/db';
import { applyClerkSyncOp, planClerkEvent } from '@/lib/clerk-sync';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/webhooks/clerk: organisation and membership changes from Clerk.
 * The signature is checked with CLERK_WEBHOOK_SIGNING_SECRET. A 5xx makes Clerk retry later;
 * only ids and the event type are logged, never names or email addresses.
 */
export async function POST(request: NextRequest) {
  let evt: WebhookEvent;
  try {
    evt = await verifyWebhook(request);
  } catch (err) {
    logger.warn('webhook.clerk_rejected', { err });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const op = planClerkEvent(evt);
  if (!op) return NextResponse.json({ ok: true, ignored: true });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'Records service unavailable' }, { status: 503 });

  try {
    await applyClerkSyncOp(op);
    logger.info('webhook.clerk', { event: evt.type, orgId: op.orgId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('webhook.clerk_failed', { event: evt.type, orgId: op.orgId, err });
    return NextResponse.json({ error: 'Temporary error' }, { status: 500 });
  }
}
