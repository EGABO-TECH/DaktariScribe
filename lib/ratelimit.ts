/**
 * Postgres token bucket (spec §6.5), no extra service needed. One atomic upsert per check.
 * If the database is unreachable the check fails open (logged), so outages don't lock users out.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '@/db';
import { logger } from '@/lib/logger';

export class RateLimitedError extends Error {
  status = 429 as const;
  constructor() {
    super('Too many requests. Please wait a moment and try again.');
    this.name = 'RateLimitedError';
  }
}

/** capacity tokens, refilled at `perMinute` tokens per minute. */
export async function rateLimit(key: string, capacity: number, perMinute: number): Promise<void> {
  try {
    const res = await getDb().execute(sql`
      insert into rate_limit (key, tokens, refilled_at) values (${key}, ${capacity - 1}, now())
      on conflict (key) do update set
        tokens = least(${capacity}::real, rate_limit.tokens + extract(epoch from (now() - rate_limit.refilled_at)) / 60.0 * ${perMinute}) - 1,
        refilled_at = now()
      returning tokens`);
    const rows = (res as unknown as { rows?: { tokens: number }[] }).rows ?? (res as unknown as { tokens: number }[]);
    const tokens = Number(rows[0]?.tokens ?? 0);
    if (tokens < 0) throw new RateLimitedError();
  } catch (err) {
    if (err instanceof RateLimitedError) throw err;
    logger.warn('ratelimit.unavailable', { key: key.split(':')[0], err });
  }
}

export const LIMITS = {
  create: [30, 10],
  upload: [600, 300],
  signoff: [30, 10],
  export: [60, 20],
  checkout: [5, 2],
  trial: [3, 1],
  translate: [20, 5],
} as const satisfies Record<string, readonly [number, number]>;

export function limit(kind: keyof typeof LIMITS, userId: string) {
  const [cap, rate] = LIMITS[kind];
  return rateLimit(`${kind}:${userId}`, cap, rate);
}
