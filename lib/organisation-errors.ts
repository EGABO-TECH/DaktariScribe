/** Turns an error from Clerk into a sentence for the person using the app. Safe on client and server. */
type ClerkErrorShape = { errors?: Array<{ code?: string; longMessage?: string; message?: string }> };

const MESSAGES: Record<string, string> = {
  organization_minimum_permissions_needed: 'An organisation needs at least one admin. Make someone else an admin first.',
  organization_membership_quota_exceeded: 'This organisation has reached its member limit.',
  already_a_member_in_organization: 'This person is already a member of the organisation.',
  duplicate_record: 'This person already has a pending invitation.',
  not_allowed_access: 'This email address is not allowed to join.',
};

export function organisationErrorMessage(err: unknown, fallback: string): string {
  const first = (err as ClerkErrorShape | null)?.errors?.[0];
  if (!first) return fallback;
  return (first.code && MESSAGES[first.code]) || first.longMessage || first.message || fallback;
}

/** True when Clerk refused the request itself, as opposed to Clerk being unreachable. */
export function isClerkRefusal(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return Boolean((err as ClerkErrorShape | null)?.errors?.length) && typeof status === 'number' && status >= 400 && status < 500;
}
