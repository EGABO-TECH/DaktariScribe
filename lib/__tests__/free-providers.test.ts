import { afterEach, describe, expect, it, vi } from 'vitest';
import { AllProvidersFailedError, configuredProviders, extractJson, FreeProviderChain } from '@/lib/ai/free-providers';
import { isProcessorConfigured } from '@/lib/ai/provider';
import { llmCostMicros } from '@/lib/billing/rates';

afterEach(() => vi.unstubAllGlobals());

const reply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: 'm' }), { status: 200 });

describe('configuredProviders', () => {
  it('keeps only providers with a key, in the default order', () => {
    const ps = configuredProviders({ COHERE_API_KEY: 'c', GROQ_API_KEY: 'g', GEMINI_API_KEY: ' ' });
    expect(ps.map((p) => p.id)).toEqual(['groq', 'cohere']);
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

  it('only sends scanned PDFs to a provider that reads PDFs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply('{"pages":[{"page":1,"text":"x"}]}'));
    vi.stubGlobal('fetch', fetchMock);
    const chain = new FreeProviderChain(configuredProviders({ GROQ_API_KEY: 'b', GEMINI_API_KEY: 'a' }));
    await chain.ocr({ data: Buffer.from('pdf'), mediaType: 'application/pdf' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
  });
});

describe('llmCostMicros', () => {
  it('records free providers at zero cost', () => {
    expect(llmCostMicros('groq/llama-3.3-70b-versatile', 1000, 1000)).toBe(0);
    expect(llmCostMicros('claude-sonnet-5-5', 1000, 0)).toBe(2000);
  });
});
