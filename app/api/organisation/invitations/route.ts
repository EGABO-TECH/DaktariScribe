import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clerkClient } from '@clerk/nextjs/server';
import { requireAuth } from '@/lib/auth';
import { errorResponse } from '@/lib/api';
import { limit } from '@/lib/ratelimit';
import { isClerkRefusal, organisationErrorMessage } from '@/lib/organisation-errors';
import { canManageTeam, INVITABLE_ROLES } from '@/lib/roles';

const body = z.object({
  emailAddress: z.string().trim().email().max(320),
  role: z.enum(INVITABLE_ROLES),
});

/**
 * POST /api/organisation/invitations — invites someone to the active organisation.
 * This runs on the server because only Clerk's server API can send the email link to our own
 * /accept-invitation page; from the browser it always goes to Clerk's hosted sign-in. That API
 * doesn't check the caller's permissions, so the admin check here is what protects it.
 */
export async function POST(request: Request) {
  try {
    const ctx = await requireAuth();
    if (!canManageTeam(ctx)) return NextResponse.json({ error: 'Only an organisation admin can invite people.' }, { status: 403 });
    await limit('invite', ctx.userId);
    const input = body.parse(await request.json().catch(() => null));
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const client = await clerkClient();
    try {
      await client.organizations.createOrganizationInvitation({
        organizationId: ctx.orgId,
        inviterUserId: ctx.userId,
        emailAddress: input.emailAddress,
        role: input.role,
        redirectUrl: new URL('/accept-invitation', origin).toString(),
      });
    } catch (err) {
      if (!isClerkRefusal(err)) throw err;
      return NextResponse.json({ error: organisationErrorMessage(err, 'The invitation could not be sent.') }, { status: 422 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err, 'organisation.invite');
  }
}
