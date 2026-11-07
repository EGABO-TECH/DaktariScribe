/**
 * Provider rates for the internal cost ledger (spec §7.4). Estimates only; keep in sync with
 * provider pricing pages. Values are USD micro-dollars per unit.
 */
export const RATES_USD_MICROS = {
  // per 1M tokens → per token
  llm: {
    'claude-sonnet-5-5': { input: 2, output: 10 },
    'claude-haiku-5-5': { input: 0.1, output: 0.5 },
    'claude-opus-5-5': { input: 4, output: 20 },
  } as Record<string, { input: number; output: number }>,
  // AssemblyAI ≈ $0.43 per audio hour (spec §3) → per second
  assemblyaiPerSecond: 0.43e6 / 3600,
  // Sunbird pricing to be confirmed with Sunbird AI; placeholder 0 until agreed.
  sunbirdPerSecond: 0,
  sunbirdTranslatePerChar: 0,
};

export function llmCostMicros(model: string, inputTokens: number, outputTokens: number): number {
  // Free-tier providers (recorded as "<provider>/<model>") cost nothing on the ledger.
  const r = RATES_USD_MICROS.llm[model] ?? (model.startsWith('claude-') ? RATES_USD_MICROS.llm['claude-sonnet-5-5'] : { input: 0, output: 0 });
  return Math.round(inputTokens * r.input + outputTokens * r.output);
}

export function usdToUgx(usdMicros: number): number {
  const rate = Number(process.env.USD_TO_UGX || 3700);
  return Math.round((usdMicros / 1e6) * rate);
}
