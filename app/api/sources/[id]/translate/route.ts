import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { decryptString } from '@/lib/crypto';
import { limit } from '@/lib/ratelimit';
import { sourceForRead } from '@/lib/records/service';
import { translateItems } from '@/lib/translate';
import { recordUsage } from '@/lib/billing/usage';
import { llmCostMicros, RATES_USD_MICROS } from '@/lib/billing/rates';

/**
 * POST /api/sources/:id/translate — English translation of an original (e.g. a Luganda
 * transcript) for the reviewer. Shown beside the original; never stored and never part of the record.
 */
export async function POST(_request: Request, ctx: RouteContext<'/api/sources/[id]/translate'>) {
  const { id } = await ctx.params;
  try {
    const auth = await requireAuth();
    await limit('translate', auth.userId);
    const src = await sourceForRead(auth, id);
    if (!src.rawText) return NextResponse.json({ text: '' });
    const [enc] = await getDb().select().from(schema.encounter).where(eq(schema.encounter.id, src.encounterId)).limit(1);
    const from = src.language ?? enc.interviewLanguage;
    const text = decryptString(src.rawText);
    // Translate paragraph by paragraph so a failure in one does not lose the rest.
    const paras = text.split(/\n+/).map((t, i) => ({ id: String(i), text: t }));
    const r = await translateItems(paras, from, 'eng');
    await recordUsage({
      orgId: auth.orgId,
      userId: auth.userId,
      kind: 'translation_chars',
      quantity: r.chars,
      costUsdMicros: r.usage ? llmCostMicros(r.usage.model, r.usage.inputTokens, r.usage.outputTokens) : r.chars * RATES_USD_MICROS.sunbirdTranslatePerChar,
      encounterId: enc.id,
    });
    return NextResponse.json({ text: r.items.map((i) => i.text).join('\n'), engine: r.engine }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err, 'source.translate', { sourceId: id });
  }
}
