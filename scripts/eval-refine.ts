/**
 * Refinement evaluation (spec §5 Phase 2.6, §7 "Eval"). Runs every fixture in eval/fixtures
 * through the real pipeline (pseudonymise → refine → spans → coverage → verification) and
 * reports facts that were ADDED, DROPPED or CHANGED. Exits 1 if any fact was added.
 *
 *   npm run eval:refine            # needs ANTHROPIC_API_KEY (paid, no-training tier)
 *   npm run eval:refine -- --offline   # harness self-check: uses the unchanged original
 *
 * Fixtures must be synthetic or fully de-identified. Never commit real patient data.
 * Fixture: { id, templateId, language, source, facts: string[] }  ("no X" = a negated finding)
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildRefinePrompt, ensureCoverage, toRefinedRecord } from '../lib/ai/refine';
import { recordFromSources, type RefinedRecord } from '../lib/records/refined-record';
import { GLOBAL_TEMPLATES } from '../lib/templates/global-templates';
import { verifyRecord } from '../lib/verify';
import { numberMentions, wordNumbers } from '../lib/verify/numbers';
import { meaningfulTokens } from '../lib/text/sentences';
import { expandForComparison } from '../lib/verify/spans';

try {
  process.loadEnvFile('.env.local');
} catch {
  /* optional */
}

type Fixture = { id: string; templateId: string; language: string; source: string; facts: string[] };
type Result = { id: string; added: string[]; dropped: string[]; changed: string[]; blockingFlags: number };

const offline = process.argv.includes('--offline');

function outputText(rec: RefinedRecord): string {
  return [...rec.sections.flatMap((s) => s.lines.map((l) => l.text)), ...rec.fields.filter((f) => f.status === 'recorded').map((f) => String(f.value))].join('\n');
}

const NEG = /\b(no|not|denies|denied|without|negative|nil|absent|none)\b/i;

function factPresent(fact: string, out: string): boolean {
  const outExpanded = expandForComparison(out).toLowerCase();
  const negated = /^(no|not)\b/i.test(fact);
  const body = fact.replace(/^(no|not)\s+/i, '');
  const nums = numberMentions(body).map((n) => n.value);
  const outNums = new Set([...numberMentions(out).map((n) => n.value), ...wordNumbers(out)]);
  if (nums.some((n) => !outNums.has(n))) return false;
  const words = meaningfulTokens(body).filter((w) => !/\d/.test(w));
  if (!words.every((w) => outExpanded.includes(w.replace(/s$/, '')))) return false;
  if (negated) {
    const idx = outExpanded.indexOf(words[0] ?? body.toLowerCase());
    const before = outExpanded.slice(Math.max(0, idx - 60), idx);
    return NEG.test(before) || NEG.test(outExpanded.slice(idx, idx + 30));
  }
  return true;
}

async function refine(f: Fixture): Promise<RefinedRecord> {
  const tpl = GLOBAL_TEMPLATES.find((t) => t.id === f.templateId) ?? GLOBAL_TEMPLATES[0];
  const sources = [{ id: 'src', text: f.source }];
  if (offline) return recordFromSources(sources, tpl.definition);
  const { getProcessor } = await import('../lib/ai/provider');
  const processor = await getProcessor();
  const prompt = buildRefinePrompt(sources, tpl.definition, null);
  const { output } = await processor.refine({ system: prompt.system, user: prompt.user });
  return ensureCoverage(toRefinedRecord(output, { sentences: prompt.sentences, sources, def: tpl.definition, map: prompt.map }), prompt.sentences);
}

async function main() {
  const dir = path.join(process.cwd(), 'eval', 'fixtures');
  const fixtures: Fixture[] = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  if (!offline && !process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Use --offline to self-check the harness.');
    process.exit(2);
  }
  const results: Result[] = [];
  for (const f of fixtures) {
    const tpl = GLOBAL_TEMPLATES.find((t) => t.id === f.templateId) ?? GLOBAL_TEMPLATES[0];
    const rec = await refine(f);
    const v = verifyRecord({ sources: [{ id: 'src', text: f.source }], record: rec, fields: tpl.definition.sections.flatMap((s) => s.fields) });
    const out = outputText(rec);
    // ADDED: anything verification proves is not in the source (numbers, units, dates, drugs, unsupported lines).
    const added = v.issues.filter((i) => i.check !== 'negation').map((i) => `${i.check}: ${i.note}`);
    // CHANGED: negation or result polarity flipped.
    const changed = v.issues.filter((i) => i.check === 'negation').map((i) => i.note);
    // DROPPED: clinician-labelled facts that no longer appear in the output.
    const dropped = f.facts.filter((fact) => !factPresent(fact, out));
    results.push({ id: f.id, added, dropped, changed, blockingFlags: v.summary.blocking });
  }

  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(`\nRefinement eval (${offline ? 'offline self-check' : process.env.AI_MODEL_REFINE || 'claude-sonnet-5-5'}) — ${results.length} fixtures\n`);
  console.log(`${pad('fixture', 22)}${pad('added', 8)}${pad('dropped', 9)}${pad('changed', 9)}blocking`);
  for (const r of results) console.log(`${pad(r.id, 22)}${pad(r.added.length, 8)}${pad(r.dropped.length, 9)}${pad(r.changed.length, 9)}${r.blockingFlags}`);
  const totals = results.reduce((t, r) => ({ added: t.added + r.added.length, dropped: t.dropped + r.dropped.length, changed: t.changed + r.changed.length }), { added: 0, dropped: 0, changed: 0 });
  console.log(`\nTOTAL  added ${totals.added}  dropped ${totals.dropped}  changed ${totals.changed}`);
  for (const r of results) {
    for (const a of r.added) console.log(`  [added]   ${r.id}: ${a}`);
    for (const c of r.changed) console.log(`  [changed] ${r.id}: ${c}`);
    for (const d of r.dropped) console.log(`  [dropped] ${r.id}: ${d}`);
  }
  if (totals.added > 0) {
    console.error('\nFAIL: facts were added. Gate 2 requires 0 added facts.');
    process.exit(1);
  }
  console.log('\nPASS: 0 added facts.');
}

main().catch((err) => {
  console.error('eval failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
