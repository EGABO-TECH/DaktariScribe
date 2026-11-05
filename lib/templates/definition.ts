import { z } from 'zod';

/** Template definition (spec §4.1). Labels are keyed by ISO 639-3 code and human-translated. */
export const localisedLabel = z.record(z.string().min(3).max(3), z.string().min(1));

export const templateField = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: localisedLabel,
  type: z.enum(['text', 'number', 'boolean', 'choice', 'date']),
  unit: z.string().optional(),
  choices: z.array(z.string()).optional(),
  metric: z.boolean().optional(),
  required: z.boolean().optional(),
});

export const templateSection = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: localisedLabel,
  fields: z.array(templateField),
});

export const templateDefinition = z
  .object({ sections: z.array(templateSection).min(1) })
  .superRefine((def, ctx) => {
    const seen = new Set<string>();
    for (const s of def.sections) {
      for (const f of s.fields) {
        if (seen.has(f.key)) ctx.addIssue({ code: 'custom', message: `Duplicate field key: ${f.key}` });
        seen.add(f.key);
        if (f.type === 'choice' && !f.choices?.length)
          ctx.addIssue({ code: 'custom', message: `Choice field ${f.key} needs choices` });
      }
    }
  });

export type TemplateField = z.infer<typeof templateField>;
export type TemplateSection = z.infer<typeof templateSection>;
export type TemplateDefinition = z.infer<typeof templateDefinition>;

/** Pick a label in the requested language, falling back to English, then the first available. */
export function labelFor(label: Record<string, string>, lang = 'eng'): string {
  return label[lang] ?? label.eng ?? Object.values(label)[0] ?? '';
}

export function allFields(def: TemplateDefinition): TemplateField[] {
  return def.sections.flatMap((s) => s.fields);
}
