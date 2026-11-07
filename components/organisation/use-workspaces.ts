'use client';

import { useCallback } from 'react';
import { useOrganizationList } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export const AFTER_SWITCH_URL = '/field-entry';

/** One shared set of options, so the header and the pages read the same cached lists. */
const LIST_OPTIONS = {
  userMemberships: { infinite: true as const, pageSize: 20, keepPreviousData: true },
  userInvitations: { infinite: true as const, pageSize: 20, keepPreviousData: true, status: 'pending' as const },
};

/** Clerk's organisation lists and actions, for our own workspace screens. */
export function useWorkspaces() {
  const router = useRouter();
  const { isLoaded, setActive, createOrganization, userMemberships, userInvitations } = useOrganizationList(LIST_OPTIONS);
  const revalidateMemberships = userMemberships.revalidate;
  const revalidateInvitations = userInvitations.revalidate;

  const refreshLists = useCallback(async () => {
    await Promise.all([revalidateMemberships?.(), revalidateInvitations?.()]);
  }, [revalidateMemberships, revalidateInvitations]);

  /** Null opens the personal workspace. */
  const switchTo = useCallback(
    async (orgId: string | null, destination: string = AFTER_SWITCH_URL) => {
      await setActive?.({ organization: orgId });
      router.push(destination);
      router.refresh();
    },
    [setActive, router],
  );

  return { isLoaded, createOrganization, setActive, userMemberships, userInvitations, refreshLists, switchTo };
}
