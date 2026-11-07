/**
 * Free / low-cost text processors for the prototype. Server only.
 *
 * Every provider here exposes an OpenAI-compatible Chat Completions endpoint, so one small
 * fetch client serves all of them. Model names and base URLs are overridable per provider
 * (e.g. GROQ_MODEL, KIMI_BASE_URL) because free line-ups change often.
 *
 * Speed (records must be ready in seconds, even when a provider misbehaves):
 * - Each request has a short timeout (AI_TIMEOUT_MS, default 30 s), not minutes.
 * - Failing providers are remembered and skipped for a while (bad key/model: 30 min; timeouts
 *   and server errors: 3 min; rate limits: 1 min), so one bad provider can't slow every record.
 * - Hedging: if the first provider hasn't answered after AI_HEDGE_MS (default 8 s), the next
 *   healthy one starts in parallel and the first valid answer wins.
 * - Reasoning models are asked for minimal reasoning (this task is extraction, not puzzling).
 *
 * PRIVACY: free tiers may log prompts or use them for training. Inputs are pseudonymised before
 * they get here, but use test data only until a paid, no-training tier is in place.
 */
import { z } from 'zod';
import type { OcrRequest, RefineRequest, TextProcessor, TranslateRequest, Usage } from './provider';
import { modelOcrOutput, modelRefineOutput, modelTranslateOutput } from './schemas';
import { TRANSLATE_SYSTEM, translateUserMessage } from './prompts/translate';
import { OCR_SYSTEM } from './prompts/ocr';
import { logger } from '@/lib/logger';

export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'sambanova' | 'fireworks' | 'nvidia' | 'kimi' | 'zai' | 'cohere';

type ProviderDef = {
  id: ProviderId;
  label: string;
  env: string; // prefix: <ENV>_API_KEY, <ENV>_MODEL, <ENV>_VISION_MODEL, <ENV>_BASE_URL
  baseUrl: string;
  model: string;
  /** Model that accepts images; null when the provider has no free vision model configured. */
  visionModel: string | null;
  /** Extra request fields, dropped automatically if the endpoint rejects them. */
  extra?: Record<string, unknown>;
  /** Largest max_tokens the endpoint accepts (default 8192). */
  maxTokens?: number;
};

/** Default order: fastest reliable free tiers first (Groq ~2 s, Gemini ~4 s on a typical note). Defaults verified against each provider's /models (Nov 2026). */
export const FREE_PROVIDERS: readonly ProviderDef[] = [
  {
    id: 'groq',
    label: 'Groq',
    env: 'GROQ',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-120b',
    visionModel: null,
    extra: { reasoning_effort: 'low' },
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    env: 'GEMINI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    visionModel: 'gemini-2.5-flash',
    extra: { reasoning_effort: 'none' },
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    env: 'OPENROUTER',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemma-4-31b-it:free',
    visionModel: 'google/gemma-4-31b-it:free',
  },
  {
    id: 'sambanova',
    label: 'SambaNova',
    env: 'SAMBANOVA',
    baseUrl: 'https://api.sambanova.ai/v1',
    model: 'gpt-oss-120b',
    visionModel: null,
    extra: { reasoning_effort: 'low' },
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    env: 'NVIDIA_NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'openai/gpt-oss-120b',
    visionModel: null,
  },
  {
    id: 'zai',
    label: 'Z.ai (GLM)',
    env: 'ZAI',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    model: 'glm-4.5-flash',
    visionModel: null,
    extra: { thinking: { type: 'disabled' } },
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    env: 'KIMI',
    baseUrl: 'https://api.moonshot.ai/v1',
    model: 'kimi-latest',
    visionModel: null,
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    env: 'FIREWORKS',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    model: 'accounts/fireworks/models/gpt-oss-120b',
    visionModel: null,
  },
  {
    id: 'cohere',
    label: 'Cohere',
    env: 'COHERE',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    model: 'command-r-08-2024',
    visionModel: null,
    maxTokens: 4000,
  },
];

type Env = Record<string, string | undefined>;

export type ResolvedProvider = {
  id: ProviderId;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel: string | null;
  extra?: Record<string, unknown>;
  maxTokens: number;
};

/**
 * Providers with a key, in order. AI_PROVIDERS (comma-separated ids) narrows and reorders the
 * chain, e.g. AI_PROVIDERS=groq,gemini.
 */
export function configuredProviders(env: Env = process.env): ResolvedProvider[] {
  const order = (env.AI_PROVIDERS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const defs = order.length
    ? order.map((id) => FREE_PROVIDERS.find((p) => p.id === id)).filter((p): p is ProviderDef => Boolean(p))
    : [...FREE_PROVIDERS];
  return defs
    .filter((p) => Boolean(env[`${p.env}_API_KEY`]?.trim()))
    .map((p) => {
      const model = env[`${p.env}_MODEL`]?.trim();
      return {
        id: p.id,
        label: p.label,
        baseUrl: (env[`${p.env}_BASE_URL`]?.trim() || p.baseUrl).replace(/\/+$/, ''),
        apiKey: env[`${p.env}_API_KEY`]!.trim(),
        model: model || p.model,
        visionModel: env[`${p.env}_VISION_MODEL`]?.trim() || p.visionModel,
        // A custom model may not accept the default's tuning fields.
        extra: model ? undefined : p.extra,
        maxTokens: p.maxTokens ?? 8192,
      };
    });
}

/* ── Timing and provider health ───────────────────────────────────── */

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const timeoutMs = () => num(process.env.AI_TIMEOUT_MS, 30_000);
const hedgeMs = () => num(process.env.AI_HEDGE_MS, 8_000);
const MAX_PARALLEL = 2;

/** Provider id → time (ms) until which it is skipped. In-memory, per server instance. */
const unhealthyUntil = new Map<ProviderId, number>();

export function resetProviderHealth() {
  unhealthyUntil.clear();
}

/** How long to skip a provider after this failure (0 = don't skip; the failure was request-specific). */
export function cooldownMs(failure: { status?: number; timedOut?: boolean }): number {
  const { status, timedOut } = failure;
  if (status === 401 || status === 402 || status === 403 || status === 404) return 30 * 60_000;
  if (status === 429) return 60_000;
  if (timedOut || (status !== undefined && status >= 500)) return 3 * 60_000;
  return 0;
}

/** Thrown when every provider in the chain failed. `status` stays set only if none is worth retrying. */
export class AllProvidersFailedError extends Error {
  readonly status?: number;
  constructor(readonly failures: { provider: ProviderId; status?: number; message: string }[]) {
    super(`All text-processing providers failed (${failures.map((f) => `${f.provider}${f.status ? ` ${f.status}` : ''}`).join(', ') || 'none configured'}).`);
    this.name = 'AllProvidersFailedError';
    const retryable = failures.some((f) => f.status === undefined || f.status === 408 || f.status === 429 || f.status >= 500);
    if (!retryable && failures.length) this.status = 400;
  }
}

class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

/** Pulls the first JSON object out of a reply that may be wrapped in code fences or prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('Reply was not JSON.');
  }
}

type Message = { role: 'system' | 'user'; content: string | Array<Record<string, unknown>> };

const schemaCache = new WeakMap<z.ZodType, string>();
function schemaInstruction(schema: z.ZodType): string {
  let s = schemaCache.get(schema);
  if (!s) {
    s = `\n\nRespond with ONE JSON object only, no prose and no code fences, matching this JSON Schema exactly:\n${JSON.stringify(z.toJSONSchema(schema))}`;
    schemaCache.set(schema, s);
  }
  return s;
}

async function chat(
  p: ResolvedProvider,
  model: string,
  messages: Message[],
  opts: { json: boolean; extra: boolean; signal: AbortSignal },
): Promise<{ text: string; usage: Usage }> {
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.apiKey}`,
      ...(p.id === 'openrouter' ? { 'X-Title': 'DaktariScribe' } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      max_tokens: p.maxTokens,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      ...(opts.extra && p.extra ? p.extra : {}),
    }),
    signal: AbortSignal.any([opts.signal, AbortSignal.timeout(timeoutMs())]),
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 300);
    throw new ProviderHttpError(res.status, `${p.id} ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error(`${p.id} returned an empty reply.`);
  return {
    text,
    usage: { model: `${p.id}/${data.model ?? model}`, inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
  };
}

async function structured<T>(p: ResolvedProvider, model: string, schema: z.ZodType<T>, messages: Message[], signal: AbortSignal): Promise<{ output: T; usage: Usage }> {
  let reply: { text: string; usage: Usage };
  try {
    reply = await chat(p, model, messages, { json: true, extra: true, signal });
  } catch (err) {
    // Some endpoints reject response_format or the tuning fields for some models; the schema is in
    // the prompt anyway, so retry once with a plain request.
    if (err instanceof ProviderHttpError && err.status === 400) {
      reply = await chat(p, model, messages, { json: false, extra: false, signal });
    } else throw err;
  }
  return { output: schema.parse(extractJson(reply.text)), usage: reply.usage };
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || /timeout|timed out/i.test(err.message));
}

export class FreeProviderChain implements TextProcessor {
  readonly name = 'free-chain';

  constructor(private readonly providers: ResolvedProvider[] = configuredProviders()) {}

  /**
   * Tries providers in order, skipping recently failed ones. A failure starts the next provider at
   * once; a slow provider gets company after the hedge delay. First valid answer wins and the
   * rest are cancelled.
   */
  private run<T>(task: string, attempt: (p: ResolvedProvider, signal: AbortSignal) => Promise<T>, candidates = this.providers): Promise<T> {
    const now = Date.now();
    const healthy = candidates.filter((p) => (unhealthyUntil.get(p.id) ?? 0) <= now);
    // If every provider is cooling down, try them anyway rather than failing without asking.
    const order = healthy.length ? healthy : candidates;

    return new Promise<T>((resolve, reject) => {
      const failures: { provider: ProviderId; status?: number; message: string }[] = [];
      const controllers = new Map<ProviderId, AbortController>();
      let next = 0;
      let running = 0;
      let settled = false;
      let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

      if (!order.length) return reject(new AllProvidersFailedError([]));

      const finish = () => {
        settled = true;
        clearTimeout(hedgeTimer);
      };

      const launch = () => {
        if (settled || next >= order.length) return;
        const p = order[next++];
        const ac = new AbortController();
        controllers.set(p.id, ac);
        running++;
        clearTimeout(hedgeTimer);
        hedgeTimer = setTimeout(() => {
          if (running < MAX_PARALLEL) launch();
        }, hedgeMs());

        attempt(p, ac.signal).then(
          (value) => {
            running--;
            if (settled) return;
            finish();
            unhealthyUntil.delete(p.id);
            for (const [id, c] of controllers) if (id !== p.id) c.abort();
            resolve(value);
          },
          (err: unknown) => {
            running--;
            if (settled) return;
            const status = err instanceof ProviderHttpError ? err.status : undefined;
            const timedOut = isTimeout(err);
            const cool = cooldownMs({ status, timedOut });
            if (cool) unhealthyUntil.set(p.id, Date.now() + cool);
            failures.push({ provider: p.id, status, message: err instanceof Error ? err.message.slice(0, 200) : 'unknown error' });
            logger.warn('ai.provider_failed', { task, provider: p.id, status, timedOut, skippedForMs: cool });
            if (next < order.length) launch();
            else if (running === 0) {
              finish();
              reject(new AllProvidersFailedError(failures));
            }
          },
        );
      };

      launch();
    });
  }

  refine(req: RefineRequest) {
    const messages: Message[] = [
      { role: 'system', content: req.system + schemaInstruction(modelRefineOutput) },
      { role: 'user', content: req.user },
    ];
    return this.run('refine', (p, signal) => structured(p, p.model, modelRefineOutput, messages, signal));
  }

  async translate(req: TranslateRequest) {
    const messages: Message[] = [
      { role: 'system', content: TRANSLATE_SYSTEM + schemaInstruction(modelTranslateOutput) },
      { role: 'user', content: translateUserMessage(req) },
    ];
    const r = await this.run('translate', (p, signal) => structured(p, p.model, modelTranslateOutput, messages, signal));
    return { items: r.output.translations, usage: r.usage };
  }

  ocr(req: OcrRequest) {
    // Scanned PDFs need a provider that reads PDF files; of the free set only Gemini does.
    const candidates = this.providers.filter((p) => p.visionModel && (req.mediaType !== 'application/pdf' || p.id === 'gemini'));
    const dataUrl = `data:${req.mediaType};base64,${req.data.toString('base64')}`;
    const messages: Message[] = [
      { role: 'system', content: OCR_SYSTEM + schemaInstruction(modelOcrOutput) },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: 'Transcribe this document.' },
        ],
      },
    ];
    return this.run('ocr', (p, signal) => structured(p, p.visionModel!, modelOcrOutput, messages, signal), candidates);
  }
}
