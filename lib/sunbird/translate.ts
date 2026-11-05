/**
 * Sunbird translation (spec §5 Phase 5.2), verified against docs.sunbird.ai (Nov 2026):
 * POST /tasks/translate { source_language, target_language, text } → output.translated_text
 * (some workers return output.text). English plus 67 African languages.
 */
import { sunbirdFetch } from './auth';

export const SUNBIRD_TRANSLATE_LANGUAGES = new Set([
  'eng', 'ach', 'afr', 'aka', 'alz', 'amh', 'luc', 'teo', 'bam', 'bfa', 'bem', 'ber', 'nya', 'dga', 'dag', 'din', 'ewe', 'ful', 'hau', 'ibo',
  'ikx', 'adh', 'kab', 'keo', 'kln', 'kau', 'kdj', 'kik', 'kin', 'run', 'kdi', 'kpz', 'rwm', 'laj', 'led', 'lin', 'tlj', 'lug', 'lgg', 'rub',
  'gwr', 'luy', 'myx', 'nuj', 'luo', 'xog', 'mhi', 'mlg', 'nbl', 'pcm', 'orm', 'pok', 'cgg', 'koo', 'nyn', 'nyo', 'ruc', 'ttj', 'lsm', 'sna',
  'som', 'sot', 'swa', 'tsn', 'wol', 'xho', 'yor', 'zul',
]);

export async function sunbirdTranslate(text: string, from: string, to: string): Promise<string> {
  const res = await sunbirdFetch('/tasks/translate', (token) => ({
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_language: from, target_language: to, text }),
  }));
  if (!res.ok) throw new Error(`Sunbird translation failed (${res.status}).`);
  const data = (await res.json()) as { output?: { translated_text?: string; text?: string } };
  const out = data.output?.translated_text ?? data.output?.text;
  if (!out) throw new Error('Sunbird returned an empty translation.');
  return out;
}
