import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AllProvidersFailedError, configuredProviders, cooldownMs, extractJson, FreeProviderChain, resetProviderHealth } from '@/lib/ai/free-providers';
import { isProcessorConfigured } from '@/lib/ai/provider';
import { llmCostMicros } from '@/lib/billing/rates';
import { mapLimit } from '@/lib/pipeline/transcribe';

beforeEach(() => resetProviderHealth());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const reply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: 'm' }), { status: 200 });

describe('configuredProviders', () => {
  it('keeps only providers with a key, in the default order (fastest first)', () => {
    const ps = configuredProviders({ COHERE_API_KEY: 'c', GROQ_API_KEY: 'g', GEMINI_API_KEY: ' ' });
    expect(ps.map((p) => p.id)).toEqual(['groq', 'cohere']);
    expect(configuredProviders({ GEMINI_API_KEY: 'a', GROQ_API_KEY: 'b' }).map((p) => p.id)).toEqual(['groq', 'gemini']);
  });
  it('honours base URL overrides and per-provider token limits', () => {
    const [kimi] = configuredProviders({ KIMI_API_KEY: 'k', KIMI_BASE_URL: 'https://api.moonshot.cn/v1/' });
    expect(kimi.baseUrl).toBe('https://api.moonshot.cn/v1');
    expect(configuredProviders({ COHERE_API_KEY: 'c' })[0].maxTokens).toBeLessThanOrEqual(4096);
  });
  it('honours AI_PROVIDERS order and model overrides', () => {
    const ps = configuredProviders({ AI_PROVIDERS: 'cohere, groq', COHERE_API_KEY: 'c', GROQ_API_KEY: 'g', GROQ_MODEL: 'custom' });
    expect(ps.map((p) => p.id)).toEqual(['cohere', 'groq']);
    expect(ps[1].model).toBe('custom');
  });
});

describe('isProcessorConfigured', () => {
  it('uses the free chain by default and Anthropic only when asked', () => {
    expect(isProcessorConfigured({ GROQ_API_KEY: 'g' })).toBe(true);
    expect(isProcessorConfigured({ ANTHROPIC_API_KEY: 'a' })).toBe(false);
    expect(isProcessorConfigured({ AI_PROVIDERS: 'anthropic', ANTHROPIC_API_KEY: 'a' })).toBe(true);
  });
});

describe('extractJson', () => {
  it('reads fenced and wrapped JSON', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":2} thanks')).toEqual({ a: 2 });
    expect(() => extractJson('no json')).toThrow();
  });
});

describe('FreeProviderChain', () => {
  it('moves to the next provider after an error or bad JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(reply('not json'))
      .mockResolvedValueOnce(reply('{"translations":[{"id":"1","text":"Habari"}]}'));
    vi.stubGlobal('fetch', fetchMock);
    const chain = new FreeProviderChain(configuredProviders({ GEMINI_API_KEY: 'a', GROQ_API_KEY: 'b', COHERE_API_KEY: 'c' }));
    const r = await chain.translate({ items: [{ id: '1', text: 'Hello' }], from: 'eng', to: 'swa' });
    expect(r.items).toEqual([{ id: '1', text: 'Habari' }]);
    expect(r.usage.model).toBe('cohere/m');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reports a non-retryable failure when every provider refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad key', { status: 401 })));
    const chain = new FreeProviderChain(configuredProviders({ GROQ_API_KEY: 'b' }));
    const err = await chain.translate({ items: [], from: 'eng', to: 'swa' }).catch((e) => e);
    expect(err).toBeInstanceOf(AllProvidersFailedError);
    expect(err.status).toBe(400);
  });

  it('stays retryable when a provider was only rate-limited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('slow down', { status: 429 })));
    const chain = new FreeProviderChain(configuredProviders({ GROQ_API_KEY: 'b' }));
    const err = await chain.translate({ items: [], from: 'eng', to: 'swa' }).catch((e) => e);
    expect(err.status).toBeUndefined();
  });

  it('starts a backup provider when the first is slow, and the first valid answer wins', async () => {
    vi.stubEnv('AI_HEDGE_MS', '20');
    const fetchMock = vi.fn((url: string) =>
      url.includes('groq')
        ? new Promise<Response>((r) => setTimeout(() => r(reply('{"translations":[{"id":"1","text":"slow"}]}')), 300))
        : Promise.resolve(reply('{"translations":[{"id":"1","text":"fast"}]}')),
    );
    vi.stubGlobal('fetch', fetchMock);
    const chain = new FreeProviderChain(configuredProviders({ GROQ_API_KEY: 'b', GEMINI_API_KEY: 'a' }));
    const t0 = Date.now();
    const r = await chain.translate({ items: [{ id: '1', text: 'Hello' }], from: 'eng', to: 'swa' });
    expect(r.items[0].text).toBe('fast');
    expect(Date.now() - t0).toBeLessThan(250);
  });

  it('skips a provider that just rejected the key, instead of asking it again', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(url.includes('groq') ? new Response('bad key', { status: 401 }) : reply('{"translations":[{"id":"1","text":"ok"}]}')),
    );
    vi.stubGlobal('fetch', fetchMock);
    const chain = new FreeProviderChain(configuredProviders({ GROQ_API_KEY: 'b', GEMINI_API_KEY: 'a' }));
    await chain.translate({ items: [{ id: '1', text: 'x' }], from: 'eng', to: 'swa' });
    await chain.translate({ items: [{ id: '1', text: 'x' }], from: 'eng', to: 'swa' });
    // groq once (401, then skipped) + gemini twice
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('groq'))).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('only sends scanned PDFs to a provider that reads PDFs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply('{"pages":[{"page":1,"text":"x"}]}'));
    vi.stubGlobal('fetch', fetchMock);
    const chain = new FreeProviderChain(configuredProviders({ GROQ_API_KEY: 'b', GEMINI_API_KEY: 'a' }));
    await chain.ocr({ data: Buffer.from('pdf'), mediaType: 'application/pdf' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
  });
});

describe('cooldownMs', () => {
  it('skips bad keys/models longest, timeouts briefly, and never request-specific errors', () => {
    expect(cooldownMs({ status: 401 })).toBe(30 * 60_000);
    expect(cooldownMs({ status: 404 })).toBe(30 * 60_000);
    expect(cooldownMs({ timedOut: true })).toBe(3 * 60_000);
    expect(cooldownMs({ status: 503 })).toBe(3 * 60_000);
    expect(cooldownMs({ status: 429 })).toBe(60_000);
    expect(cooldownMs({ status: 400 })).toBe(0);
    expect(cooldownMs({})).toBe(0);
  });
});

describe('mapLimit', () => {
  it('runs at most N at once and keeps the input order', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([30, 5, 20, 1, 10], 3, async (ms) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, ms));
      inFlight--;
      return ms * 2;
    });
    expect(out).toEqual([60, 10, 40, 2, 20]);
    expect(peak).toBe(3);
  });
});

describe('llmCostMicros', () => {
  it('records free providers at zero cost', () => {
    expect(llmCostMicros('groq/llama-3.3-70b-versatile', 1000, 1000)).toBe(0);
    expect(llmCostMicros('claude-sonnet-5-5', 1000, 0)).toBe(2000);
  });
});
