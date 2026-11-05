import type { RefinedRecord, SourceSpan } from '@/lib/records/refined-record';
import type { TemplateField } from '@/lib/templates/definition';

export type SourceText = { id: string; text: string };

export type Target = { kind: 'line'; section: string; index: number } | { kind: 'field'; key: string };

export type Issue = {
  target: Target;
  check: 'spans' | 'numbers' | 'drugs' | 'negation';
  kind: 'not_in_source' | 'possible_conflict';
  note: string;
  blocking: boolean;
};

/** A permitted change worth showing the reviewer (e.g. a spelling fix of a drug name). */
export type Change = { target: Target; note: string };

export type VerifyInput = {
  sources: SourceText[];
  record: RefinedRecord;
  fields: TemplateField[];
};

export type CheckResult = { issues: Issue[]; changes?: Change[] };

/** Everything an output item "says", plus the source text it claims to come from. */
export type Item = { target: Target; text: string; spans: SourceSpan[]; sourceText: string };

export function spannedText(spans: SourceSpan[], sources: SourceText[]): string {
  return spans
    .map((s) => {
      const src = sources.find((x) => x.id === s.sourceId);
      return src ? src.text.slice(s.start, s.end) : '';
    })
    .join(' ');
}

/** Lines and recorded fields as uniform items. Field text is "label value unit"-free: just the value. */
export function itemsOf(input: VerifyInput): Item[] {
  const items: Item[] = [];
  for (const sec of input.record.sections) {
    sec.lines.forEach((l, index) =>
      items.push({ target: { kind: 'line', section: sec.key, index }, text: l.text, spans: l.spans, sourceText: spannedText(l.spans, input.sources) }),
    );
  }
  for (const f of input.record.fields) {
    if (f.status !== 'recorded' || f.value === null) continue;
    items.push({ target: { kind: 'field', key: f.key }, text: String(f.value), spans: f.spans, sourceText: spannedText(f.spans, input.sources) });
  }
  return items;
}

export function allSourceText(sources: SourceText[]): string {
  return sources.map((s) => s.text).join('\n');
}
