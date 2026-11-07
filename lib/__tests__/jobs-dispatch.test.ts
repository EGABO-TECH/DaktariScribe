import { describe, expect, it, vi } from 'vitest';

vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));

import { inngestEnabled } from '@/lib/jobs/dispatch';
import { isPermanentProviderError } from '@/lib/pipeline/refine';

describe('inngestEnabled', () => {
  it('runs jobs in-process in next dev even when cloud keys are set', () => {
    expect(inngestEnabled({ NODE_ENV: 'development', INNGEST_EVENT_KEY: 'k' })).toBe(false);
  });
  it('uses the local Inngest dev server when INNGEST_DEV is set', () => {
    expect(inngestEnabled({ NODE_ENV: 'development', INNGEST_DEV: '1' })).toBe(true);
  });
  it('uses Inngest Cloud in production when the event key is set', () => {
    expect(inngestEnabled({ NODE_ENV: 'production', INNGEST_EVENT_KEY: 'k' })).toBe(true);
    expect(inngestEnabled({ NODE_ENV: 'production' })).toBe(false);
  });
});

describe('isPermanentProviderError', () => {
  it('does not retry billing, auth and bad-request errors', () => {
    for (const status of [400, 401, 403, 404]) expect(isPermanentProviderError({ status })).toBe(true);
  });
  it('retries rate limits, timeouts and server errors', () => {
    for (const status of [408, 409, 429, 500, 529]) expect(isPermanentProviderError({ status })).toBe(false);
    expect(isPermanentProviderError(new Error('network'))).toBe(false);
    expect(isPermanentProviderError(null)).toBe(false);
  });
});
