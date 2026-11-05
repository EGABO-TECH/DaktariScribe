/** Every 10 minutes: re-check payments pending > 3 min with Nylon Pay; expire after 30 min (spec §7.3). */
import { and, sql } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { logger } from '@/lib/logger';
import { fetchStatus, nylonPayConfigured } from './nylonpay';
import { applyProviderStatus, expireStale } from './payments';

export async function reconcilePendingPayments() {
  if (!nylonPayConfigured()) return { checked: 0, expired: 0 };
  const rows = await getDb()
    .select({ reference: schema.payment.reference })
    .from(schema.payment)
    .where(
      and(
        sql`${schema.payment.status} in ('pending','processing')`,
        sql`${schema.payment.createdAt} < now() - interval '3 minutes'`,
        sql`${schema.payment.createdAt} > now() - interval '30 minutes'`,
      ),
    )
    .limit(100);
  let checked = 0;
  for (const r of rows) {
    try {
      const s = await fetchStatus(r.reference);
      if (s) await applyProviderStatus(r.reference, s.status, s.id);
      checked++;
    } catch (err) {
      logger.warn('reconcile.status_failed', { reference: r.reference, err });
    }
  }
  const expired = await expireStale(30);
  return { checked, expired };
}
