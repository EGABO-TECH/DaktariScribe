import { describe, it, expect } from 'vitest';
import { newRecordId, RECORD_ID_PATTERN } from '@/lib/ids';
import { recordFromTypedText, refinedRecord, NOTES_SECTION_KEY } from '@/lib/records/refined-record';
import { formatFieldValue } from '@/lib/records/format';
import { scrub } from '@/lib/logger';
import { mapClerkRole, personalOrgId } from '@/lib/auth';
import { templateDefinition } from '@/lib/templates/definition';
import { GLOBAL_TEMPLATES } from '@/lib/templates/global-templates';
import { rebuildNoteLines } from '@/components/records/RecordEditor';

describe('record IDs', () => {
  it('uses the DS-YYYY-DD-MM-NANO-XXXX format with the encounter date', () => {
    const id = newRecordId('2026-08-01');
    expect(id).toMatch(RECORD_ID_PATTERN);
    expect(id.startsWith('DS-2026-01-08-')).toBe(true);
  });
  it('is unique', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newRecordId()));
    expect(ids.size).toBe(2000);
  });
});

describe('global templates', () => {
  it('all validate and include the five required templates', () => {
    for (const t of GLOBAL_TEMPLATES) expect(() => templateDefinition.parse(t.definition)).not.toThrow();
    expect(GLOBAL_TEMPLATES.map((t) => t.name)).toEqual([
      'General consultation',
      'Antenatal visit',
      'Immunisation session',
      'Community survey / interview',
      'Custom (free sections)',
    ]);
  });
});

describe('recordFromTypedText', () => {
  const def = GLOBAL_TEMPLATES[0].definition;
  const raw = '  Fever for 3 days, temp 38.5.\nNo vomiting.\n\n\nRDT positive. Given ACT.  \n';

  it('maps each paragraph to a line whose span is exactly that text in the original', () => {
    const rec = recordFromTypedText('src1', raw, def);
    refinedRecord.parse(rec);
    const lines = rec.sections.find((s) => s.key === NOTES_SECTION_KEY)!.lines;
    expect(lines.map((l) => l.text)).toEqual(['Fever for 3 days, temp 38.5.\nNo vomiting.', 'RDT positive. Given ACT.']);
    for (const l of lines) {
      const { start, end } = l.spans[0];
      expect(raw.slice(start, end)).toBe(l.text);
    }
  });

  it('adds nothing: every field starts not recorded', () => {
    const rec = recordFromTypedText('src1', raw, def);
    expect(rec.fields.length).toBeGreaterThan(0);
    expect(rec.fields.every((f) => f.status === 'not_recorded' && f.value === null && f.spans.length === 0)).toBe(true);
  });
});

describe('rebuildNoteLines', () => {
  it('keeps spans for unchanged paragraphs and drops them for edited ones', () => {
    const prev = [
      { text: 'Fever 3 days.', spans: [{ sourceId: 's', start: 0, end: 13 }] },
      { text: 'Gave PCM.', spans: [{ sourceId: 's', start: 15, end: 24 }] },
    ];
    const out = rebuildNoteLines('Fever 3 days.\n\nGave paracetamol.', prev);
    expect(out[0].spans).toHaveLength(1);
    expect(out[1]).toEqual({ text: 'Gave paracetamol.', spans: [] });
  });
});

describe('formatFieldValue', () => {
  it('formats values without inventing any', () => {
    expect(formatFieldValue({ type: 'number', unit: '°C' }, 38.5)).toBe('38.5 °C');
    expect(formatFieldValue({ type: 'boolean' }, true)).toBe('Yes');
    expect(formatFieldValue({ type: 'boolean' }, false)).toBe('No');
    expect(formatFieldValue({ type: 'text' }, null)).toBe('Not recorded');
    expect(formatFieldValue({ type: 'date' }, '2026-08-01')).toBe('01 Aug 2026');
  });
});

describe('logger.scrub', () => {
  it('drops content fields, including nested ones', () => {
    const out = scrub({ encounterId: 'DS-1', text: 'secret', meta: { rawText: 'x', transcript: 'y', ok: 1 }, prompt: 'p' });
    expect(out).toEqual({ encounterId: 'DS-1', meta: { ok: 1 } });
  });
});

describe('auth role mapping', () => {
  it('maps Clerk org roles and personal workspaces', () => {
    expect(mapClerkRole('org:admin')).toBe('admin');
    expect(mapClerkRole('org:supervisor')).toBe('supervisor');
    expect(mapClerkRole('org:member')).toBe('worker');
    expect(mapClerkRole(null)).toBe('worker');
    expect(personalOrgId('user_1')).toBe('personal_user_1');
  });
});
