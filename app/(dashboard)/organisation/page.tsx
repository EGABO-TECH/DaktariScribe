import PageShell from '@/components/layout/PageShell';
import OrganisationManager from '@/components/organisation/OrganisationManager';

export const metadata = { title: 'Organisation — DaktariScribe' };

export default function OrganisationPage() {
  return (
    <PageShell title="Organisation" description="Your team, their roles and who can see what." width="max-w-4xl">
      <OrganisationManager />
    </PageShell>
  );
}
