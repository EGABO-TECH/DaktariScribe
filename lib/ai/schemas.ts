import { z } from 'zod';

/**
 * What the text processor returns for refinement. It cites source SENTENCE IDs (S1, S2, …)
 * rather than character offsets; the server turns those into exact spans (lib/ai/refine.ts),
 * because sentence references are far more reliable than counted offsets.
 * Uses nullable rather than optional fields for structured-output compatibility.
 */
export const modelRefineOutput = z.object({
  sections: z.array(
    z.object({
      key: z.string(),
      lines: z.array(
        z.object({
          text: z.string(),
          sentenceIds: z.array(z.string()),
          quote: z.string().nullable(),
          flags: z.array(
            z.object({
              kind: z.enum(['unclear_audio', 'illegible', 'unknown_abbreviation', 'possible_conflict', 'not_in_source']),
              note: z.string(),
            }),
          ),
        }),
      ),
    }),
  ),
  fields: z.array(
    z.object({
      key: z.string(),
      value: z.string().nullable(),
      sentenceIds: z.array(z.string()),
      status: z.enum(['recorded', 'not_recorded']),
    }),
  ),
  suggestedCodes: z.array(
    z.object({
      system: z.enum(['ICD-10', 'ICD-11']),
      code: z.string(),
      label: z.string(),
      sectionKey: z.string(),
      lineIndex: z.number().int(),
    }),
  ),
});
export type ModelRefineOutput = z.infer<typeof modelRefineOutput>;

export const modelTranslateOutput = z.object({ translations: z.array(z.object({ id: z.string(), text: z.string() })) });
export type ModelTranslateOutput = z.infer<typeof modelTranslateOutput>;

export const modelOcrOutput = z.object({ pages: z.array(z.object({ page: z.number().int(), text: z.string() })) });
export type ModelOcrOutput = z.infer<typeof modelOcrOutput>;
