import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DatabaseNotConfiguredError } from '@/db';
import { logger } from '@/lib/logger';

/** Maps known errors to generic, non-leaky JSON responses (spec §6.5). */
export function errorResponse(err: unknown, event: string, meta: Record<string, unknown> = {}) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: 'Some details are missing or invalid.', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      { status: 400 },
    );
  }
  const status = (err as { status?: number })?.status;
  if (status === 401) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  if (status === 404) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
  if (status === 403 || status === 409 || status === 429 || status === 503) return NextResponse.json({ error: (err as Error).message }, { status });
  if (status === 402) {
    const code = (err as { code?: string }).code;
    return NextResponse.json({ error: (err as Error).message, code, buyPass: true }, { status: 402 });
  }
  if (err instanceof DatabaseNotConfiguredError) {
    logger.error(`${event}.db_not_configured`, meta);
    return NextResponse.json({ error: 'The records service is not configured yet.' }, { status: 503 });
  }
  logger.error(`${event}.failed`, { ...meta, err });
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
