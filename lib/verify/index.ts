/**
 * Runs every verification check on a RefinedRecord before it is saved (spec §5 Phase 2.3) and
 * attaches the results as flags. Model-supplied `blocking`/`check`/`resolved` values are never
 * trusted: they are cleared first, then set only by these checks.
 */
import type { Flag, RefinedRecord } from '@/lib/records/refined-record';
import { checkDrugs } from './drugs';
import { checkNegation } from './negation';
import { checkNumbers } from './numbers';
import { checkSpans } from './spans';
import type { Change, Issue, Target, VerifyInput } from './types';

export type VerificationSummary = {
  ranAt: string;
  blocking: number;
  warnings: number;
  changes: number;
  byCheck: Record<Issue['check'], number>;
  /** Targets only — never patient content. */
  targets: { target: Target; check: Issue['check'] }[];
};

export type VerifyResult = { record: RefinedRecord; summary: VerificationSummary; issues: Issue[]; changes: Change[] };

function sanitise(flags: Flag[] | undefined): Flag[] {
  return (flags ?? []).map((f) => ({ kind: f.kind, note: f.note, check: 'model' as const }));
}

export function verifyRecord(input: VerifyInput): VerifyResult {
  // Strip any verification fields the model tried to set.
  const record: RefinedRecord = {
    ...input.record,
    sections: input.record.sections.map((s) => ({ ...s, lines: s.lines.map((l) => ({ ...l, flags: sanitise(l.flags) })) })),
    fields: input.record.fields.map((f) => ({ ...f, flags: sanitise(f.flags) })),
  };
  const run = { ...input, record };
  const results = [checkSpans(run), checkNumbers(run), checkDrugs(run), checkNegation(run)];
  const issues = results.flatMap((r) => r.issues);
  const changes = results.flatMap((r) => r.changes ?? []);

  for (const issue of issues) {
    const flag: Flag = { kind: issue.kind, note: issue.note, blocking: issue.blocking, check: issue.check };
    if (issue.target.kind === 'line') {
      const { section, index } = issue.target;
      const line = record.sections.find((s) => s.key === section)?.lines[index];
      if (line) line.flags = [...(line.flags ?? []), flag];
    } else {
      const key = issue.target.key;
      const field = record.fields.find((f) => f.key === key);
      if (field) field.flags = [...(field.flags ?? []), flag];
    }
  }

  const byCheck = { spans: 0, numbers: 0, drugs: 0, negation: 0 } as Record<Issue['check'], number>;
  for (const i of issues) byCheck[i.check]++;
  const modelFlags =
    record.sections.reduce((n, s) => n + s.lines.reduce((m, l) => m + (l.flags ?? []).filter((f) => f.check === 'model').length, 0), 0) +
    record.fields.reduce((n, f) => n + (f.flags ?? []).filter((x) => x.check === 'model').length, 0);

  return {
    record,
    issues,
    changes,
    summary: {
      ranAt: new Date().toISOString(),
      blocking: issues.filter((i) => i.blocking).length,
      warnings: issues.filter((i) => !i.blocking).length + modelFlags,
      changes: changes.length,
      byCheck,
      targets: issues.map((i) => ({ target: i.target, check: i.check })),
    },
  };
}

export type { Issue, Change, Target, VerifyInput } from './types';
