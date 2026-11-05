export const NAV_LINKS = [
  { href: '/field-entry', icon: 'edit_note', label: 'Field Entry', short: 'Entry', match: ['/field-entry'] },
  { href: '/saved-records', icon: 'library_books', label: 'Saved Records', short: 'Records', match: ['/saved-records', '/records'] },
  { href: '/reports', icon: 'description', label: 'Reports', short: 'Reports', match: ['/reports'] },
  { href: '/insights', icon: 'bar_chart', label: 'Insights', short: 'Insights', match: ['/insights'] },
  { href: '/billing', icon: 'confirmation_number', label: 'Billing', short: 'Billing', match: ['/billing'] },
] as const;

export function isActive(pathname: string, match: readonly string[]): boolean {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}
