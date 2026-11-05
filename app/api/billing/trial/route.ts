import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, schema } from '@/db';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { encryptString } from '@/lib/crypto';
import { limit } from '@/lib/ratelimit';
import { claimTrial } from '@/lib/billing/entitlements';
import { maskPhone, normaliseUgPhone } from '@/lib/billing/rules';

const body = z.object({ phone: z.string().max(20), deviceId: z.string().max(100).optional() });

/** POST /api/billing/trial — 7-day free trial, once per account AND per phone number. */
export async function POST(request: Request) {
  try {
    const ctx = await requireAuth();
    await limit('trial', ctx.userId);
    const input = body.parse(await request.json().catch(() => null));
    const phone = normaliseUgPhone(input.phone);
    if (!phone) return NextResponse.json({ error: 'Enter a Uganda mobile number, e.g. 0772 123456.' }, { status: 400 });
    const pass = await claimTrial(ctx.userId, phone, input.deviceId);
    await getDb()
      .insert(schema.billingProfile)
      .values({ userId: ctx.userId, phone: encryptString(phone), phoneMasked: maskPhone(phone) })
      .onConflictDoUpdate({ target: schema.billingProfile.userId, set: { phone: encryptString(phone), phoneMasked: maskPhone(phone) } });
    return NextResponse.json({ ok: true, endsAt: pass.endsAt });
  } catch (err) {
    return errorResponse(err, 'billing.trial');
  }
}
