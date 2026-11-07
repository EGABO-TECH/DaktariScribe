/** Lists chat models each configured provider currently offers (names only). npx tsx --env-file=.env.local scripts/list-ai-models.ts */
import { configuredProviders } from '../lib/ai/free-providers';

async function main() {
  for (const p of configuredProviders()) {
    try {
      const res = await fetch(`${p.baseUrl}/models`, { headers: { Authorization: `Bearer ${p.apiKey}` }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        console.log(`${p.id}: HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { data?: { id: string; pricing?: { prompt?: string } }[]; models?: { name: string }[] };
      let ids = (data.data ?? []).map((m) => (p.id === 'openrouter' && m.pricing?.prompt !== '0' ? '' : m.id)).filter(Boolean);
      if (!ids.length && data.models) ids = data.models.map((m) => m.name);
      const pick = ids.filter((id) => /llama|gpt-oss|qwen|deepseek|gemini|glm|kimi|command|mistral|gemma/i.test(id) && !/vision|guard|embed|whisper|tts|audio|image|rerank/i.test(id));
      console.log(`${p.id} (${ids.length} models): ${pick.slice(0, 25).join(', ')}`);
    } catch (err) {
      console.log(`${p.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

void main();
