/**
 * Free / low-cost text processors for the prototype. Server only.
 *
 * Every provider here exposes an OpenAI-compatible Chat Completions endpoint, so one small
 * fetch client serves all of them. Providers are tried in order until one returns output that
 * passes the zod schema; a provider that errors, rate-limits or returns malformed JSON is
 * skipped for that call. Model names are overridable per provider (e.g. GROQ_MODEL) because
 * free model line-ups change often.
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
  keyEnv: string;
  modelEnv: string;
  visionModelEnv: string;
  baseUrl: string;
  model: string;
  /** Model that accepts images; null when the provider has no free vision model configured. */
  visionModel: string | null;
};

/** Default order: generous free tiers and reliable JSON output first. */
export const FREE_PROVIDERS: readonly ProviderDef[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyEnv: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_MODEL',
    visionModelEnv: 'GEMINI_VISION_MODEL',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    visionModel: 'gemini-2.5-flash',
  },
  {
    id: 'groq',
    label: 'Groq',
    keyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL',
    visionModelEnv: 'GROQ_VISION_MODEL',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    visionModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    visionModelEnv: 'OPENROUTER_VISION_MODEL',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    visionModel: null,
  },
  {
    id: 'sambanova',
    label: 'SambaNova',
    keyEnv: 'SAMBANOVA_API_KEY',
    modelEnv: 'SAMBANOVA_MODEL',
    visionModelEnv: 'SAMBANOVA_VISION_MODEL',
    baseUrl: 'https://api.sambanova.ai/v1',
    model: 'Meta-Llama-3.3-70B-Instruct',
    visionModel: null,
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    keyEnv: 'NVIDIA_NIM_API_KEY',
    modelEnv: 'NVIDIA_NIM_MODEL',
    visionModelEnv: 'NVIDIA_NIM_VISION_MODEL',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.3-70b-instruct',
    visionModel: null,
  },
  {
    id: 'zai',
    label: 'Z.ai (GLM)',
    keyEnv: 'ZAI_API_KEY',
    modelEnv: 'ZAI_MODEL',
    visionModelEnv: 'ZAI_VISION_MODEL',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    model: 'glm-4.5-flash',
    visionModel: null,
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    keyEnv: 'KIMI_API_KEY',
    modelEnv: 'KIMI_MODEL',
    visionModelEnv: 'KIMI_VISION_MODEL',
    baseUrl: 'https://api.moonshot.ai/v1',
    model: 'kimi-latest',
    visionModel: null,
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    keyEnv: 'FIREWORKS_API_KEY',
    modelEnv: 'FIREWORKS_MODEL',
    visionModelEnv: 'FIREWORKS_VISION_MODEL',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    visionModel: null,
  },
  {
    id: 'cohere',
    label: 'Cohere',
    keyEnv: 'COHERE_API_KEY',
    modelEnv: 'COHERE_MODEL',
    visionModelEnv: 'COHERE_VISION_MODEL',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    model: 'command-a-03-2025',
    visionModel: null,
  },
];

type Env = Record<string, string | undefined>;

export type ResolvedProvider = { id: ProviderId; label: string; baseUrl: string; apiKey: string; model: string; visionModel: string | null };

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
    .filter((p) => Boolean(env[p.keyEnv]?.trim()))
    .map((p) => ({
      id: p.id,
      label: p.label,
      baseUrl: p.baseUrl,
      apiKey: env[p.keyEnv]!.trim(),
      model: env[p.modelEnv]?.trim() || p.model,
      visionModel: env[p.visionModelEnv]?.trim() || p.visionModel,
    }));
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

function schemaInstruction(schema: z.ZodType): string {
  return `\n\nRespond with ONE JSON object only, no prose and no code fences, matching this JSON Schema exactly:\n${JSON.stringify(z.toJSONSchema(schema))}`;
}

async function chat(p: ResolvedProvider, model: string, messages: Message[], json: boolean): Promise<{ text: string; usage: Usage }> {
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
      max_tokens: 8192,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
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

async function structured<T>(p: ResolvedProvider, model: string, schema: z.ZodType<T>, messages: Message[]): Promise<{ output: T; usage: Usage }> {
  let reply: { text: string; usage: Usage };
  try {
    reply = await chat(p, model, messages, true);
  } catch (err) {
    // Some endpoints reject response_format for some models; the schema is in the prompt anyway.
    if (err instanceof ProviderHttpError && err.status === 400 && /response_format|json/i.test(err.message)) {
      reply = await chat(p, model, messages, false);
    } else throw err;
  }
  return { output: schema.parse(extractJson(reply.text)), usage: reply.usage };
}

export class FreeProviderChain implements TextProcessor {
  readonly name = 'free-chain';

  constructor(private readonly providers: ResolvedProvider[] = configuredProviders()) {}

  private async run<T>(task: string, attempt: (p: ResolvedProvider) => Promise<T>, candidates = this.providers): Promise<T> {
    const failures: { provider: ProviderId; status?: number; message: string }[] = [];
    for (const p of candidates) {
      try {
        return await attempt(p);
      } catch (err) {
        const status = err instanceof ProviderHttpError ? err.status : undefined;
        const message = err instanceof Error ? err.message.slice(0, 200) : 'unknown error';
        failures.push({ provider: p.id, status, message });
        logger.warn('ai.provider_failed', { task, provider: p.id, status });
      }
    }
    throw new AllProvidersFailedError(failures);
  }

  refine(req: RefineRequest) {
    return this.run('refine', (p) =>
      structured(p, p.model, modelRefineOutput, [
        { role: 'system', content: req.system + schemaInstruction(modelRefineOutput) },
        { role: 'user', content: req.user },
      ]),
    );
  }

  async translate(req: TranslateRequest) {
    const r = await this.run('translate', (p) =>
      structured(p, p.model, modelTranslateOutput, [
        { role: 'system', content: TRANSLATE_SYSTEM + schemaInstruction(modelTranslateOutput) },
        { role: 'user', content: translateUserMessage(req) },
      ]),
    );
    return { items: r.output.translations, usage: r.usage };
  }

  ocr(req: OcrRequest) {
    // Scanned PDFs need a provider that reads PDF files; of the free set only Gemini does.
    const candidates = this.providers.filter((p) => p.visionModel && (req.mediaType !== 'application/pdf' || p.id === 'gemini'));
    const dataUrl = `data:${req.mediaType};base64,${req.data.toString('base64')}`;
    return this.run(
      'ocr',
      (p) =>
        structured(p, p.visionModel!, modelOcrOutput, [
          { role: 'system', content: OCR_SYSTEM + schemaInstruction(modelOcrOutput) },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: 'Transcribe this document.' },
            ],
          },
        ]),
      candidates,
    );
  }
}
