/**
 * Text-processing provider interface (spec §5 Phase 2.1). Implementations must use a paid,
 * no-training API tier. Inputs are pseudonymised by the caller before they reach a provider.
 * Provider and models are chosen by env vars (AI_PROVIDER, AI_MODEL_REFINE, AI_MODEL_FAST).
 */
import type { ModelOcrOutput, ModelRefineOutput } from './schemas';

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
    super('No text-processing provider is configured (set ANTHROPIC_API_KEY).');
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

export function isProcessorConfigured(): boolean {
  const provider = process.env.AI_PROVIDER ?? 'anthropic';
  return provider === 'anthropic' && Boolean(process.env.ANTHROPIC_API_KEY);
}

let cached: TextProcessor | null = null;

export async function getProcessor(): Promise<TextProcessor> {
  if (cached) return cached;
  if (!isProcessorConfigured()) throw new ProcessorNotConfiguredError();
  const { AnthropicProcessor } = await import('./anthropic');
  cached = new AnthropicProcessor();
  return cached;
}
