/**
 * Anthropic implementation of TextProcessor. Server only.
 *
 * - Structured output (`output_config.format` via betaZodOutputFormat), never free text.
 * - No `temperature`: current models reject non-default sampling parameters; determinism and
 *   faithfulness come from the schema, the prompt, and the code verification in lib/verify.
 * - Server-side refusal fallback ("default") is enabled so a policy decline on one model is
 *   retried on a suitable fallback model inside the same call; a final refusal is surfaced
 *   as ProcessingDeclinedError and the worker's original note is used instead.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { OcrRequest, RefineRequest, TextProcessor, TranslateRequest, Usage } from './provider';
import { ProcessingDeclinedError } from './provider';
import { modelOcrOutput, modelRefineOutput, modelTranslateOutput } from './schemas';
import { TRANSLATE_SYSTEM, translateUserMessage } from './prompts/translate';
import { OCR_SYSTEM } from './prompts/ocr';

const REFINE_MODEL = () => process.env.AI_MODEL_REFINE || 'claude-sonnet-5-5';
const FAST_MODEL = () => process.env.AI_MODEL_FAST || 'claude-haiku-5-5';

/** Server-side fallback is offered for Sonnet 5.5 / Opus on the Claude API; not for Haiku. */
function fallbackFor(model: string): { betas: ['server-side-fallback-2026-07-01']; fallbacks: 'default' } | Record<string, never> {
  return /^claude-(sonnet-5-5|opus-5|opus-5-5|fable-5-1)$/.test(model)
    ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }
    : {};
}

function usageOf(msg: { model: string; usage: { input_tokens: number; output_tokens: number } }): Usage {
  return { model: msg.model, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens };
}

export class AnthropicProcessor implements TextProcessor {
  readonly name = 'anthropic';
  private client = new Anthropic({ maxRetries: 3, timeout: 120_000 });

  async refine(req: RefineRequest) {
    const model = REFINE_MODEL();
    const msg = await this.client.beta.messages.parse({
      model,
      max_tokens: 16000,
      ...fallbackFor(model),
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: req.user }],
      output_config: { format: betaZodOutputFormat(modelRefineOutput) },
    });
    if (msg.stop_reason === 'refusal') throw new ProcessingDeclinedError();
    if (msg.stop_reason === 'max_tokens' || !msg.parsed_output) throw new Error('Refinement output was incomplete.');
    return { output: msg.parsed_output, usage: usageOf(msg) };
  }

  async translate(req: TranslateRequest) {
    const model = FAST_MODEL();
    const msg = await this.client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system: [{ type: 'text', text: TRANSLATE_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: translateUserMessage(req) }],
      output_config: { format: betaZodOutputFormat(modelTranslateOutput) },
    });
    if (msg.stop_reason === 'refusal') throw new ProcessingDeclinedError();
    if (!msg.parsed_output) throw new Error('Translation output was incomplete.');
    return { items: msg.parsed_output.translations, usage: usageOf(msg) };
  }

  async ocr(req: OcrRequest) {
    const model = REFINE_MODEL();
    const data = req.data.toString('base64');
    const block =
      req.mediaType === 'application/pdf'
        ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } as const)
        : ({ type: 'image', source: { type: 'base64', media_type: req.mediaType, data } } as const);
    const msg = await this.client.beta.messages.parse({
      model,
      max_tokens: 16000,
      ...fallbackFor(model),
      system: OCR_SYSTEM,
      messages: [{ role: 'user', content: [block, { type: 'text', text: 'Transcribe this document.' }] }],
      output_config: { format: betaZodOutputFormat(modelOcrOutput) },
    });
    if (msg.stop_reason === 'refusal') throw new ProcessingDeclinedError();
    if (!msg.parsed_output) throw new Error('Transcription output was incomplete.');
    return { output: msg.parsed_output, usage: usageOf(msg) };
  }
}
