/**
 * Guard against known speech-model failure modes (spec §3b):
 * - drops empty / punctuation-only segments (silence),
 * - collapses a phrase repeated 3+ times in a row (to one occurrence),
 * and reports what was removed so the reviewer can see it.
 */
import type { TranscriptSegment } from './types';

export type GuardReport = { droppedEmpty: number; collapsedRepeats: number };

/** Collapses "x x x x" → "x" for runs of 3+ identical phrases of 1–8 words. */
export function collapseRepeats(text: string): { text: string; collapsed: number } {
  let collapsed = 0;
  let out = text;
  for (let n = 8; n >= 1; n--) {
    const phrase = `((?:\\S+\\s+){${n - 1}}\\S+?)`;
    const re = new RegExp(`${phrase}(?:[\\s,.]+\\1){2,}(?=[\\s,.]|$)`, 'gi');
    out = out.replace(re, (_m, p1: string) => {
      collapsed++;
      return p1;
    });
  }
  return { text: out, collapsed };
}

export function guardSegments(segments: TranscriptSegment[]): { segments: TranscriptSegment[]; report: GuardReport } {
  const report: GuardReport = { droppedEmpty: 0, collapsedRepeats: 0 };
  const kept: TranscriptSegment[] = [];
  let prevText = '';
  let prevRun = 0;
  for (const s of segments) {
    const { text, collapsed } = collapseRepeats(s.text.trim());
    report.collapsedRepeats += collapsed;
    if (!/[\p{L}\p{N}]/u.test(text)) {
      report.droppedEmpty++;
      continue;
    }
    // Whole segments repeated 3+ times in a row.
    if (text.toLowerCase() === prevText) {
      prevRun++;
      if (prevRun >= 2) {
        report.collapsedRepeats++;
        continue;
      }
    } else {
      prevText = text.toLowerCase();
      prevRun = 0;
    }
    kept.push({ ...s, text });
  }
  return { segments: kept, report };
}

/**
 * Plain text for refinement, with speaker turns on their own lines. Also records each
 * segment's character range in that text so review can jump from a line to the audio.
 */
export function transcriptText(segments: TranscriptSegment[]): string {
  return buildTranscript(segments).text;
}

export function buildTranscript(segments: TranscriptSegment[]): { text: string; segments: TranscriptSegment[] } {
  let text = '';
  let lastSpeaker: string | undefined;
  const out: TranscriptSegment[] = [];
  for (const s of segments) {
    let prefix: string;
    if (s.speaker && s.speaker !== lastSpeaker) {
      prefix = (text ? '\n' : '') + s.speaker + ': ';
      lastSpeaker = s.speaker;
    } else if (s.speaker) prefix = ' ';
    else prefix = text ? '\n' : '';
    text += prefix;
    const charStart = text.length;
    text += s.text;
    out.push({ ...s, charStart, charEnd: text.length });
  }
  return { text, segments: out };
}
