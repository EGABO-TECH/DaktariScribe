import { canViewAudit, canViewCosts, canViewInsights, isPersonalOrg, type WorkspaceAccess } from '@/lib/roles';

type NavLink = {
  href: string;
  icon: string;
  label: string;
  short: string;
  match: readonly string[];
  /** Left out means everyone who is signed in. */
  allowed?: (access: WorkspaceAccess) => boolean;
};

export const NAV_LINKS: readonly NavLink[] = [
  { href: '/field-entry', icon: 'edit_note', label: 'Field Entry', short: 'Entry', match: ['/field-entry'] },
  { href: '/saved-records', icon: 'library_books', label: 'Saved Records', short: 'Records', match: ['/saved-records', '/records'] },
  { href: '/reports', icon: 'description', label: 'Reports', short: 'Reports', match: ['/reports'] },
  { href: '/insights', icon: 'bar_chart', label: 'Insights', short: 'Insights', match: ['/insights'], allowed: canViewInsights },
  { href: '/billing', icon: 'confirmation_number', label: 'Billing', short: 'Billing', match: ['/billing'] },
];

/** In the sidebar and the account menu; the phone's bottom bar has no room for them. */
export const ADMIN_LINKS: readonly NavLink[] = [
  { href: '/organisation', icon: 'groups', label: 'Organisation', short: 'Team', match: ['/organisation'], allowed: (a) => !isPersonalOrg(a.orgId) },
  { href: '/admin/audit', icon: 'history', label: 'Audit log', short: 'Audit', match: ['/admin/audit'], allowed: canViewAudit },
  { href: '/admin/costs', icon: 'payments', label: 'Costs', short: 'Costs', match: ['/admin/costs'], allowed: canViewCosts },
];

export function visibleLinks(links: readonly NavLink[], access: WorkspaceAccess | null): NavLink[] {
  return links.filter((l) => !l.allowed || (access !== null && l.allowed(access)));
}

export function isActive(pathname: string, match: readonly string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}
