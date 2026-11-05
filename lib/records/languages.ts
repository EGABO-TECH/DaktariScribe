/** Interview languages (ISO 639-3). Names are shown in English and in the language itself. */
export const INTERVIEW_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'lug', name: 'Luganda' },
  { code: 'nyn', name: 'Runyankole' },
  { code: 'swa', name: 'Kiswahili' },
  { code: 'ach', name: 'Acholi' },
  { code: 'teo', name: 'Ateso' },
  { code: 'lgg', name: 'Lugbara' },
  { code: 'xog', name: 'Lusoga' },
  { code: 'fra', name: 'French' },
] as const;

export const INTERVIEW_LANGUAGE_CODES = INTERVIEW_LANGUAGES.map((l) => l.code) as [
  (typeof INTERVIEW_LANGUAGES)[number]['code'],
  ...(typeof INTERVIEW_LANGUAGES)[number]['code'][],
];

export function languageName(code: string): string {
  return INTERVIEW_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
