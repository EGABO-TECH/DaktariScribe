/** Inngest client and functions (spec §3: jobs as steps with retries). */
import { Inngest } from 'inngest';
import type { JobEvent, JobName } from './events';
import { handle, onFailure } from './handlers';

export const inngest = new Inngest({ id: 'daktariscribe' });

function jobFunction(id: string, name: JobName, retries: 3 | 4 = 4) {
  return inngest.createFunction(
    {
      id,
      triggers: [{ event: name }],
      retries,
      onFailure: async ({ event }) => {
        // event.data.event is the original event that failed for good.
        const original = (event.data as { event: JobEvent }).event;
        await onFailure(original);
      },
    },
    async ({ event, step }) => {
      await step.run(id, async () => {
        await handle({ name, data: event.data } as JobEvent, { rethrow: true });
      });
    },
  );
}

export const refineFn = jobFunction('encounter-refine', 'encounter/refine.requested');
export const transcribeFn = jobFunction('source-transcribe', 'source/transcribe.requested', 3);
export const extractFn = jobFunction('source-extract', 'source/extract.requested', 3);

export const reconcilePaymentsFn = inngest.createFunction(
  { id: 'billing-reconcile-payments', triggers: [{ cron: '*/10 * * * *' }] },
  async ({ step }) => {
    await step.run('reconcile', async () => {
      const { reconcilePendingPayments } = await import('@/lib/billing/reconcile');
      return reconcilePendingPayments();
    });
  },
);

export const functions = [refineFn, transcribeFn, extractFn, reconcilePaymentsFn];
