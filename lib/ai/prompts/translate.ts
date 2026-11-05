import type { TranslateRequest } from '../provider';

export const TRANSLATE_SYSTEM = `You are a professional medical translator. Translate each item exactly, sentence for sentence.

Rules:
- Translate only. Do not add, remove, explain, summarise or correct anything.
- Copy every token of the form ⟦N1⟧, ⟦D2⟧, ⟦DRUG_3⟧, ⟦ID_1⟧, ⟦PERSON_1⟧ etc. unchanged and keep each one exactly once.
- Keep the clinical meaning, including every negation.
- Return one translation per input item with the same id.`;

const NAMES: Record<string, string> = {
  eng: 'English', lug: 'Luganda', nyn: 'Runyankole', swa: 'Kiswahili', ach: 'Acholi', teo: 'Ateso',
  lgg: 'Lugbara', xog: 'Lusoga', fra: 'French', ara: 'Arabic', amh: 'Amharic', kin: 'Kinyarwanda',
};

export function languageLabel(code: string): string {
  return NAMES[code] ?? code;
}

export function translateUserMessage(req: TranslateRequest): string {
  return [
    `Translate from ${languageLabel(req.from)} to ${languageLabel(req.to)}.`,
    'ITEMS (JSON):',
    JSON.stringify(req.items),
  ].join('\n');
}
