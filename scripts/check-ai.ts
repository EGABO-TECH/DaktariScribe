/**
 * Times one organising call per configured text provider, using a synthetic eval fixture.
 * Prints provider, model, time and pass/fail only; never keys or note content.
 *
 *   npm run ai:check
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildRefinePrompt } from '../lib/ai/refine';
import { configuredProviders, FreeProviderChain } from '../lib/ai/free-providers';
import { GLOBAL_TEMPLATES } from '../lib/templates/global-templates';

async function main() {
  const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'eval', 'fixtures', '01-malaria.json'), 'utf8')) as { templateId: string; source: string };
  const tpl = GLOBAL_TEMPLATES.find((t) => t.id === fixture.templateId) ?? GLOBAL_TEMPLATES[0];
  const prompt = buildRefinePrompt([{ id: 'src', text: fixture.source }], tpl.definition, null);
  const providers = configuredProviders();
  if (!providers.length) {
    console.log('No text provider keys are set (GEMINI_API_KEY, GROQ_API_KEY, …).');
    return;
  }
  console.log(`Prompt: ${prompt.system.length + prompt.user.length} characters. Providers in order: ${providers.map((p) => p.id).join(', ')}\n`);
  for (const p of providers) {
    const chain = new FreeProviderChain([p]);
    const t0 = Date.now();
    try {
      const r = await chain.refine({ system: prompt.system, user: prompt.user });
      console.log(`${p.id.padEnd(11)} ${p.model.padEnd(48)} ${String(Date.now() - t0).padStart(6)} ms  OK   ${r.usage.inputTokens}+${r.usage.outputTokens} tokens`);
    } catch (err) {
      const f = (err as { failures?: { status?: number; message: string }[] }).failures?.[0];
      const why = f ? `${f.status ?? 'no status'}: ${f.message.replace(/\s+/g, ' ').slice(0, 110)}` : String(err).slice(0, 110);
      console.log(`${p.id.padEnd(11)} ${p.model.padEnd(48)} ${String(Date.now() - t0).padStart(6)} ms  FAIL ${why}`);
    }
  }

  // What a record actually experiences: the whole chain (skipping, backups), run three times.
  console.log('\nFull chain, as used for real records:');
  const { resetProviderHealth } = await import('../lib/ai/free-providers');
  resetProviderHealth();
  const chain = new FreeProviderChain(providers);
  for (let i = 1; i <= 3; i++) {
    const t0 = Date.now();
    try {
      const r = await chain.refine({ system: prompt.system, user: prompt.user });
      console.log(`  run ${i}: ${String(Date.now() - t0).padStart(6)} ms  answered by ${r.usage.model}`);
    } catch (err) {
      console.log(`  run ${i}: ${String(Date.now() - t0).padStart(6)} ms  FAILED ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error('check failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
