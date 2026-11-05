/**
 * Minimal structured logger that never writes patient content (spec §0.2 rule 5, §6.6).
 * Log record IDs and actions only. Any field whose name looks like content is dropped.
 */
const BLOCKED = /^(text|transcript|prompt|content|rawText|raw_text|segments|respondentRef|respondent_ref|note|notes|body)$/i;

type Meta = Record<string, unknown>;

export function scrub(meta: Meta = {}): Meta {
  const out: Meta = {};
  for (const [k, v] of Object.entries(meta)) {
    if (BLOCKED.test(k)) continue;
    if (v instanceof Error) out[k] = { name: v.name, message: v.message };
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = scrub(v as Meta);
    else out[k] = v;
  }
  return out;
}

function write(level: 'info' | 'warn' | 'error', event: string, meta?: Meta) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...scrub(meta) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, meta?: Meta) => write('info', event, meta),
  warn: (event: string, meta?: Meta) => write('warn', event, meta),
  error: (event: string, meta?: Meta) => write('error', event, meta),
};
