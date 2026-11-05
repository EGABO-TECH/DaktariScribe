/**
 * Fixed report labels from human-translated catalogues (messages/<lang>.json). Never
 * machine-translated at export time (spec §5 Phase 5.2). Missing languages fall back to English.
 */
import eng from '@/messages/eng.json';
import fra from '@/messages/fra.json';
import swa from '@/messages/swa.json';
import lug from '@/messages/lug.json';
import nyn from '@/messages/nyn.json';

type Catalogue = typeof eng;
export type LabelKey = keyof Catalogue['export'];

const CATALOGUES: Record<string, Catalogue> = { eng, fra, swa, lug, nyn };

export type Labels = {
  lang: string;
  /** Catalogue status, e.g. "reviewed" or a draft/untranslated note. */
  status: string;
  t(key: LabelKey, vars?: Record<string, string | number>): string;
};

export function labelsFor(lang: string): Labels {
  const cat = CATALOGUES[lang] ?? eng;
  return {
    lang: CATALOGUES[lang] ? lang : 'eng',
    status: cat._status,
    t(key, vars) {
      let s = (cat.export as Record<string, string>)[key] ?? (eng.export as Record<string, string>)[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
      return s;
    },
  };
}

/** Output languages offered in the export dialog, with label-catalogue quality. */
export const EXPORT_LANGUAGES = [
  { code: 'eng', name: 'English', labels: 'reviewed' },
  { code: 'fra', name: 'French', labels: 'draft' },
  { code: 'swa', name: 'Kiswahili', labels: 'draft' },
  { code: 'lug', name: 'Luganda', labels: 'english' },
  { code: 'nyn', name: 'Runyankole', labels: 'english' },
  { code: 'ach', name: 'Acholi', labels: 'english' },
  { code: 'teo', name: 'Ateso', labels: 'english' },
  { code: 'lgg', name: 'Lugbara', labels: 'english' },
  { code: 'xog', name: 'Lusoga', labels: 'english' },
  { code: 'kin', name: 'Kinyarwanda', labels: 'english' },
  { code: 'ara', name: 'Arabic', labels: 'english' },
  { code: 'amh', name: 'Amharic', labels: 'english' },
] as const;

/** Formats dates for the report locale with Intl. */
export function formatDate(d: Date | string, lang: string, withTime = false): string {
  const locale = { eng: 'en-GB', fra: 'fr-FR', swa: 'sw-KE', ara: 'ar', amh: 'am-ET', kin: 'rw-RW' }[lang] ?? 'en-GB';
  const date = typeof d === 'string' ? new Date(`${d}T00:00:00Z`) : d;
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } : {}),
      timeZone: withTime ? 'Africa/Kampala' : 'UTC',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
