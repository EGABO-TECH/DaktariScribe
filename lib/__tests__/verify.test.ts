import { describe, it, expect } from 'vitest';
import { verifyRecord } from '@/lib/verify';
import { checkNumbers, numberMentions, wordNumbers } from '@/lib/verify/numbers';
import { checkDrugs } from '@/lib/verify/drugs';
import { checkNegation, negatedTerms } from '@/lib/verify/negation';
import { checkSpans } from '@/lib/verify/spans';
import { splitSentences } from '@/lib/text/sentences';
import { countBlockingFlags, type RefinedRecord } from '@/lib/records/refined-record';
import type { TemplateField } from '@/lib/templates/definition';

const SRC =
  'Pt 34 y/o female c/o headache and fever x 2 days. Denies nausea or vomiting. BP 120/80 mmHg, temp 38.5 C. mRDT positive. Given AL 80/480 mg BD x 3 days and PCM 1g. Review in 3 days.';
const sources = [{ id: 's1', text: SRC }];
const fields: TemplateField[] = [
  { key: 'temperature_c', label: { eng: 'Temperature' }, type: 'number', unit: '°C' },
  { key: 'malaria_rdt', label: { eng: 'Malaria RDT' }, type: 'choice', choices: ['Positive', 'Negative'] },
];

/** Span covering the source sentence containing `needle`. */
function spanOf(needle: string) {
  const s = splitSentences(SRC).find((x) => x.text.includes(needle));
  if (!s) throw new Error(`no sentence for ${needle}`);
  return [{ sourceId: 's1', start: s.start, end: s.end }];
}

function rec(lines: { text: string; spans: ReturnType<typeof spanOf> }[], extraFields: RefinedRecord['fields'] = []): RefinedRecord {
  return { sections: [{ key: 'notes', lines }], fields: extraFields };
}

const faithful = rec(
  [
    { text: '34-year-old female complains of headache and fever for 2 days.', spans: spanOf('headache') },
    { text: 'Denies nausea or vomiting.', spans: spanOf('Denies') },
    { text: 'Blood pressure 120/80 mmHg, temperature 38.5 °C.', spans: spanOf('BP') },
    { text: 'Malaria rapid diagnostic test positive.', spans: spanOf('mRDT') },
    { text: 'Given artemether-lumefantrine 80/480 mg twice daily for 3 days and paracetamol 1g.', spans: spanOf('Given') },
  ],
  [
    { key: 'temperature_c', value: 38.5, spans: spanOf('temp'), status: 'recorded' },
    { key: 'malaria_rdt', value: 'Positive', spans: spanOf('mRDT'), status: 'recorded' },
  ],
);

describe('helpers', () => {
  it('splits sentences without breaking decimals', () => {
    const s = splitSentences('Temp 38.5 C. BP ok.\nNext line');
    expect(s.map((x) => x.text)).toEqual(['Temp 38.5 C.', 'BP ok.', 'Next line']);
    for (const x of s) expect('Temp 38.5 C. BP ok.\nNext line'.slice(x.start, x.end)).toBe(x.text);
  });
  it('parses digit and word numbers', () => {
    expect(numberMentions('BP 120/80 mmHg, 38,5 C').map((m) => m.value)).toEqual(['120', '80', '38.5']);
    expect(wordNumbers('temperature thirty-eight point five, one hundred and twenty')).toEqual(['38.5', '120']);
    expect(numberMentions('SpO2 97%').map((m) => m.value)).toEqual(['97']);
  });
  it('finds negated terms', () => {
    expect(negatedTerms('Denies nausea or vomiting. No fever.')).toEqual(expect.arrayContaining(['nausea', 'vomiting', 'fever']));
  });
});

describe('faithful output', () => {
  it('passes every check with no blocking flags', () => {
    const r = verifyRecord({ sources, record: faithful, fields });
    expect(r.issues).toEqual([]);
    expect(countBlockingFlags(r.record)).toBe(0);
  });
});

describe('injected errors are caught', () => {
  it('invented number', () => {
    const bad = rec([{ text: 'Temperature 39.5 °C.', spans: spanOf('temp') }]);
    expect(checkNumbers({ sources, record: bad, fields }).issues[0]).toMatchObject({ check: 'numbers', blocking: true });
  });
  it('invented number in a field', () => {
    const bad = rec([], [{ key: 'temperature_c', value: 37, spans: spanOf('temp'), status: 'recorded' }]);
    expect(checkNumbers({ sources, record: bad, fields }).issues).toHaveLength(1);
  });
  it('changed unit', () => {
    const bad = rec([{ text: 'AL 80/480 g given.', spans: spanOf('Given') }]);
    expect(checkNumbers({ sources, record: bad, fields }).issues[0]?.note).toMatch(/unit/);
  });
  it('invented drug', () => {
    const bad = rec([{ text: 'Given artemether-lumefantrine and amoxicillin.', spans: spanOf('Given') }]);
    const r = checkDrugs({ sources, record: bad, fields });
    expect(r.issues[0]?.note).toMatch(/amoxicillin/);
  });
  it('allows a close spelling fix and records it as a change', () => {
    const src = [{ id: 's1', text: 'Given paracetmol 1g.' }];
    const r = checkDrugs({ sources: src, record: rec([{ text: 'Given paracetamol 1g.', spans: [{ sourceId: 's1', start: 0, end: 20 }] }]), fields });
    expect(r.issues).toEqual([]);
    expect(r.changes).toHaveLength(1);
  });
  it('dropped negation', () => {
    const bad = rec([{ text: 'Reports nausea and vomiting.', spans: spanOf('Denies') }]);
    expect(checkNegation({ sources, record: bad, fields }).issues[0]).toMatchObject({ check: 'negation', blocking: true });
  });
  it('flipped result polarity', () => {
    const bad = rec([{ text: 'Malaria rapid diagnostic test negative.', spans: spanOf('mRDT') }]);
    expect(checkNegation({ sources, record: bad, fields }).issues).toHaveLength(1);
  });
  it('span-less line', () => {
    const bad = rec([{ text: 'Advised to start physiotherapy.', spans: [] }]);
    expect(checkSpans({ sources, record: bad, fields }).issues[0]).toMatchObject({ check: 'spans', blocking: true });
  });
  it('out-of-bounds span', () => {
    const bad = rec([{ text: 'Headache.', spans: [{ sourceId: 's1', start: 0, end: 99999 }] }]);
    expect(checkSpans({ sources, record: bad, fields }).issues).toHaveLength(1);
  });
  it('line whose words are not in its span', () => {
    const bad = rec([{ text: 'Advised to commence physiotherapy immediately.', spans: spanOf('Review') }]);
    expect(checkSpans({ sources, record: bad, fields }).issues).toHaveLength(1);
  });
  it('verifyRecord attaches blocking flags and ignores model-set blocking', () => {
    const sneaky = rec([{ text: 'Temperature 40 °C.', spans: spanOf('temp'), flags: [{ kind: 'not_in_source', note: 'x', blocking: false, resolved: true }] } as never]);
    const r = verifyRecord({ sources, record: sneaky, fields });
    expect(countBlockingFlags(r.record)).toBe(1);
    expect(r.summary.blocking).toBe(1);
  });
});
