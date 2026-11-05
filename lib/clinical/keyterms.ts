/**
 * Keyterms for English speech recognition (spec §3b): essential medicines, common clinical
 * terms and Ugandan place/facility names. Organisations can append their own terms later.
 * AssemblyAI caps the keyterm list, so we send at most 200.
 */
import { DRUG_NAMES } from './drugs';

const CLINICAL = [
  'malaria', 'RDT', 'mRDT', 'artemether-lumefantrine', 'antenatal', 'ANC', 'IPTp', 'sulfadoxine-pyrimethamine', 'MUAC',
  'pneumonia', 'diarrhoea', 'dehydration', 'ORS', 'zinc', 'HIV', 'ART', 'viral load', 'tuberculosis', 'GeneXpert',
  'hypertension', 'pre-eclampsia', 'eclampsia', 'haemoglobin', 'anaemia', 'jaundice', 'malnutrition', 'kwashiorkor',
  'immunisation', 'BCG', 'OPV', 'pentavalent', 'measles-rubella', 'HPV', 'AEFI', 'VHT', 'health centre III', 'HC IV',
];

const PLACES = [
  'Kampala', 'Wakiso', 'Mukono', 'Jinja', 'Mbale', 'Gulu', 'Lira', 'Arua', 'Mbarara', 'Kabale', 'Fort Portal', 'Masaka',
  'Hoima', 'Kiryandongo', 'Soroti', 'Tororo', 'Moroto', 'Kasese', 'Bundibugyo', 'Nakivale', 'Bidibidi', 'Kyangwali', 'Adjumani',
  'Mulago', 'Kiruddu', 'Kawempe', 'Naguru', 'Lacor',
];

export function keytermsFor(language: string, orgTerms: string[] = []): string[] {
  if (language !== 'eng') return orgTerms.slice(0, 200);
  return [...new Set([...orgTerms, ...CLINICAL, ...PLACES, ...DRUG_NAMES.filter((d) => !d.includes(' '))])].slice(0, 200);
}
