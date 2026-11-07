/**
 * Text-processing provider interface (spec §5 Phase 2.1). Inputs are pseudonymised by the
 * caller before they reach a provider.
 *
 * Prototype default: a chain of free providers (lib/ai/free-providers.ts), used whenever at
 * least one of their keys is set. Set AI_PROVIDERS=anthropic to use Anthropic instead
 * (needs ANTHROPIC_API_KEY and account credit). The spec requires a paid, no-training tier for
 * production; free tiers may log or train on what they receive, so use test data only.
 */
import type { ModelOcrOutput, ModelRefineOutput } from './schemas';
import { configuredProviders } from './free-providers';

export type Usage = { model: string; inputTokens: number; outputTokens: number };

export type RefineRequest = { system: string; user: string };
export type TranslateRequest = { items: { id: string; text: string }[]; from: string; to: string };
export type OcrRequest = { data: Buffer; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf' };

export interface TextProcessor {
  readonly name: string;
  refine(req: RefineRequest): Promise<{ output: ModelRefineOutput; usage: Usage }>;
  translate(req: TranslateRequest): Promise<{ items: { id: string; text: string }[]; usage: Usage }>;
  ocr(req: OcrRequest): Promise<{ output: ModelOcrOutput; usage: Usage }>;
}

export class ProcessorNotConfiguredError extends Error {
  constructor() {
    super('No text-processing provider is configured (set one of GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, …).');
    this.name = 'ProcessorNotConfiguredError';
  }
}

/** The provider declined the request (e.g. a safety refusal). Never retried automatically. */
export class ProcessingDeclinedError extends Error {
  constructor(message = 'The text-processing service declined this request.') {
    super(message);
    this.name = 'ProcessingDeclinedError';
  }
}

type Env = Record<string, string | undefined>;

function wantsAnthropic(env: Env): boolean {
  return (env.AI_PROVIDERS ?? '').trim().toLowerCase() === 'anthropic';
}

export function isProcessorConfigured(env: Env = process.env): boolean {
  if (wantsAnthropic(env)) return Boolean(env.ANTHROPIC_API_KEY);
  return configuredProviders(env).length > 0;
}

let cached: TextProcessor | null = null;

export async function getProcessor(): Promise<TextProcessor> {
  if (cached) return cached;
  if (!isProcessorConfigured()) throw new ProcessorNotConfiguredError();
  if (wantsAnthropic(process.env)) {
    const { AnthropicProcessor } = await import('./anthropic');
    cached = new AnthropicProcessor();
  } else {
    const { FreeProviderChain } = await import('./free-providers');
    cached = new FreeProviderChain();
  }
  return cached;
}
