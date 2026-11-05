import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { billingEnforced, getActivePass } from '@/lib/billing/entitlements';
import { product } from '@/lib/billing/plans';
import { reportsLeft, voiceSecondsLeft, warnings } from '@/lib/billing/rules';

/** GET /api/billing/me — current pass for the header chip and banners. */
export async function GET() {
  try {
    const ctx = await requireAuth();
    if (!billingEnforced()) return NextResponse.json({ enforced: false }, { headers: { 'Cache-Control': 'no-store' } });
    const p = await getActivePass(ctx.userId, ctx.orgId);
    return NextResponse.json(
      {
        enforced: true,
        pass: p
          ? {
              productCode: p.productCode,
              name: product(p.productCode).name,
              endsAt: p.endsAt.toISOString(),
              reportsLeft: reportsLeft(p),
              reportsTotal: p.reportsTotal,
              voiceMinutesLeft: Math.floor(voiceSecondsLeft(p) / 60),
              voiceMinutesTotal: Math.floor(p.voiceSecondsTotal / 60),
              features: p.features,
            }
          : null,
        warnings: warnings(p),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    return errorResponse(err, 'billing.me');
  }
}
