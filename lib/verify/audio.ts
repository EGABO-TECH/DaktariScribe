/**
 * "Unclear audio" flags (spec §3b): words the speech service heard with confidence below 0.6
 * mark every line whose span covers them. Non-blocking: the reviewer listens and accepts or edits.
 */
import type { RefinedRecord } from '@/lib/records/refined-record';

export type UncertainRange = { sourceId: string; start: number; end: number; words: string[] };

export function flagUnclearAudio(rec: RefinedRecord, ranges: UncertainRange[]): RefinedRecord {
  if (!ranges.length) return rec;
  const hit = (spans: { sourceId: string; start: number; end: number }[]) =>
    ranges.find((r) => spans.some((s) => s.sourceId === r.sourceId && s.start < r.end && s.end > r.start));
  return {
    ...rec,
    sections: rec.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) => {
        const r = hit(l.spans);
        if (!r) return l;
        const note = `Some words were hard to hear (${r.words.slice(0, 4).join(', ')}). Listen to the recording to check.`;
        return { ...l, flags: [...(l.flags ?? []), { kind: 'unclear_audio' as const, note, check: 'transcript' as const }] };
      }),
    })),
  };
}

/** Builds ranges from stored transcript segments (charStart/charEnd + lowConfidence words). */
export function uncertainRanges(sourceId: string, segments: { charStart?: number; charEnd?: number; lowConfidence?: string[] }[]): UncertainRange[] {
  return segments
    .filter((g) => g.lowConfidence?.length && g.charStart !== undefined && g.charEnd !== undefined)
    .map((g) => ({ sourceId, start: g.charStart!, end: g.charEnd!, words: g.lowConfidence! }));
}
