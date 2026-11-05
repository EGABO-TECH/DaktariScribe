/**
 * Content translation (spec §5 Phase 5.2). Server only.
 * Pipeline per item: pseudonymise → protect numbers/dates/doses/drugs/IDs → translate →
 * restore protected values (fail if any changed) → restore pseudonyms.
 * Engine: Sunbird for English ↔ African languages; the text processor (fast model,
 * translate-only prompt) for others such as French and Arabic.
 */
import { getProcessor, isProcessorConfigured } from '@/lib/ai/provider';
import { pseudonymise, restore, type PseudonymMap } from '@/lib/privacy/pseudonymise';
import { sunbirdConfigured } from '@/lib/sunbird/auth';
import { SUNBIRD_TRANSLATE_LANGUAGES, sunbirdTranslate } from '@/lib/sunbird/translate';
import { protect, unprotect } from './placeholders';

export type Engine = 'sunbird' | 'llm';

export class TranslationUnavailableError extends Error {
  status = 503 as const;
  constructor() {
    super('Translation is not available for this language yet.');
    this.name = 'TranslationUnavailableError';
  }
}

export function engineFor(from: string, to: string): Engine | null {
  const african = (l: string) => l !== 'eng' && SUNBIRD_TRANSLATE_LANGUAGES.has(l);
  if ((african(from) || african(to)) && SUNBIRD_TRANSLATE_LANGUAGES.has(from) && SUNBIRD_TRANSLATE_LANGUAGES.has(to) && sunbirdConfigured()) return 'sunbird';
  if (isProcessorConfigured()) return 'llm';
  return null;
}

/** Quality tier shown in the export dialog. */
export function qualityTier(to: string): 'reviewed-labels' | 'good' | 'moderate' | 'basic' {
  if (['eng', 'fra', 'swa'].includes(to)) return 'good';
  if (['lug', 'nyn', 'ach', 'teo', 'lgg', 'xog', 'kin'].includes(to)) return 'moderate';
  return 'basic';
}

export async function translateItems(
  items: { id: string; text: string }[],
  from: string,
  to: string,
  opts: { respondentRef?: string | null } = {},
): Promise<{ items: { id: string; text: string }[]; engine: Engine; chars: number; usage?: { model: string; inputTokens: number; outputTokens: number } }> {
  if (from === to) return { items, engine: 'llm', chars: 0 };
  const engine = engineFor(from, to);
  if (!engine) throw new TranslationUnavailableError();
  const pmap: PseudonymMap = new Map();
  const prepared = items
    .filter((i) => i.text.trim())
    .map((i) => {
      const p = pseudonymise(i.text, { respondentRef: opts.respondentRef, map: pmap });
      const pr = protect(p.text);
      return { id: i.id, text: pr.text, map: pr.map };
    });
  const chars = prepared.reduce((n, p) => n + p.text.length, 0);
  let translated: { id: string; text: string }[];
  let usage;
  if (engine === 'sunbird') {
    translated = [];
    for (const p of prepared) translated.push({ id: p.id, text: await sunbirdTranslate(p.text, from, to) });
  } else {
    const processor = await getProcessor();
    const r = await processor.translate({ items: prepared.map(({ id, text }) => ({ id, text })), from, to });
    translated = r.items;
    usage = r.usage;
  }
  const out = items.map((i) => {
    const p = prepared.find((x) => x.id === i.id);
    if (!p) return i;
    const t = translated.find((x) => x.id === i.id);
    if (!t) throw new Error('A translation item is missing.');
    return { id: i.id, text: restore(unprotect(t.text, p.map), pmap) };
  });
  return { items: out, engine, chars, usage };
}
