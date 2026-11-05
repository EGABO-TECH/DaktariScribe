/** Usage metering and cost ledger (spec §7.4). Server only. Never stores patient content. */
import { getDb, schema } from '@/db';
import { newId } from '@/lib/ids';
import { logger } from '@/lib/logger';

export type UsageKind = 'encounter' | 'audio_seconds' | 'translation_chars' | 'llm_tokens' | 'export';

export async function recordUsage(e: {
  orgId: string;
  userId: string;
  kind: UsageKind;
  quantity: number;
  costUsdMicros?: number;
  encounterId?: string | null;
}) {
  try {
    await getDb()
      .insert(schema.usageEvent)
      .values({
        id: newId(),
        orgId: e.orgId,
        userId: e.userId,
        kind: e.kind,
        quantity: Math.round(e.quantity),
        costUsdMicros: Math.round(e.costUsdMicros ?? 0),
        encounterId: e.encounterId ?? null,
      });
  } catch (err) {
    logger.error('usage.record_failed', { kind: e.kind, encounterId: e.encounterId, err });
  }
}
