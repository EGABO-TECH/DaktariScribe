/**
 * Sends a background job. With Inngest configured (INNGEST_EVENT_KEY, or INNGEST_DEV=1 for the
 * local dev server) jobs run as Inngest functions with retries. Otherwise they run in-process
 * right after the response (next/server `after`), with a small local retry loop, so the app
 * is fully functional without Inngest in development and small deployments.
 */
import { after } from 'next/server';
import { logger } from '@/lib/logger';
import type { JobEvent } from './events';
import { handle, onFailure } from './handlers';

export function inngestEnabled(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV);
}

async function runInline(event: JobEvent, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await handle(event, { rethrow: i < attempts });
      return;
    } catch (err) {
      logger.warn('job.inline_attempt_failed', { job: event.name, attempt: i, err });
      if (i < attempts) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  await onFailure(event);
}

export async function dispatch(event: JobEvent): Promise<void> {
  if (inngestEnabled()) {
    const { inngest } = await import('./inngest');
    await inngest.send({ name: event.name, data: event.data });
    return;
  }
  after(() => runInline(event));
}

/** For scripts and tests: run a job now, in this process. */
export async function runNow(event: JobEvent): Promise<void> {
  await runInline(event);
}
