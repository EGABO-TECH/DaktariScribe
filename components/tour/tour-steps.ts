/** Steps of the guided tour. `target` matches a `data-tour` attribute; no target = centred window. */
export type TourStep = {
  id: string;
  title: string;
  body: string;
  icon: string;
  /** Page the step belongs to; the tour navigates there first. */
  href?: string;
  target?: string;
  /** Skip quietly when the target isn't on screen (e.g. a page this role can't see). */
  optional?: boolean;
};

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    icon: 'waving_hand',
    title: 'Welcome to DaktariScribe',
    body: 'This short tour shows you how to capture an encounter, review it and turn it into a finished report. It takes about a minute, and you can skip it at any time.',
  },
  {
    id: 'nav-field-entry',
    icon: 'edit_note',
    href: '/field-entry',
    target: 'nav-field-entry',
    title: 'Field Entry: start here',
    body: 'Every encounter starts on Field Entry. Drafts are saved on this device as you type, so nothing is lost if the connection drops.',
  },
  {
    id: 'encounter-details',
    icon: 'badge',
    href: '/field-entry',
    target: 'encounter-details',
    title: '1. Fill in the encounter details',
    body: 'Choose a template, then add the site, date and interview language. Use a local reference for the respondent, never their name, and tick consent once it is given.',
  },
  {
    id: 'capture-methods',
    icon: 'mic',
    href: '/field-entry',
    target: 'capture-methods',
    title: '2. Type, record or upload',
    body: 'Type your notes, record the conversation, or upload photos and documents. You can combine all three in one encounter.',
  },
  {
    id: 'process',
    icon: 'arrow_forward',
    href: '/field-entry',
    target: 'process-button',
    title: '3. Process the encounter',
    body: 'When you are done, select Process. The notes are organised into the template as a draft for you to check. Offline? It is queued and sent when you reconnect.',
  },
  {
    id: 'nav-saved-records',
    icon: 'library_books',
    href: '/saved-records',
    target: 'nav-saved-records',
    title: 'Saved Records: review and sign off',
    body: 'Every encounter appears here with its status. Open one marked "Ready for review", compare the draft with your original notes, correct anything, then sign it off.',
  },
  {
    id: 'nav-reports',
    icon: 'description',
    href: '/reports',
    target: 'nav-reports',
    title: 'Reports: download finished records',
    body: 'Signed-off records are grouped by month and day here, ready to download as PDF field reports.',
  },
  {
    id: 'nav-insights',
    icon: 'bar_chart',
    href: '/insights',
    target: 'nav-insights',
    optional: true,
    title: 'Insights: see the bigger picture',
    body: 'Supervisors can chart recorded values across signed-off records, filter by date and site, and build a slide deck.',
  },
  {
    id: 'nav-billing',
    icon: 'confirmation_number',
    href: '/billing',
    target: 'nav-billing',
    title: 'Billing: your pass',
    body: 'Check how many reports and voice minutes are left on your pass, and download receipts. Passes are prepaid and never renew automatically.',
  },
  {
    id: 'workspace',
    icon: 'groups',
    target: 'workspace-switcher',
    optional: true,
    title: 'Switch workspace',
    body: 'Work on your own, or switch to your organisation to share records with your team. Invitations to join a team also appear here.',
  },
  {
    id: 'help',
    icon: 'help',
    target: 'tour-help',
    title: 'You are all set',
    body: 'Open this tour again any time from the help button. Start by capturing your first encounter on Field Entry.',
  },
];
