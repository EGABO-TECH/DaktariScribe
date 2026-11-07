import PageShell from '@/components/layout/PageShell';
import CreateOrganisationForm from '@/components/organisation/CreateOrganisationForm';

export const metadata = { title: 'Create organisation — DaktariScribe' };

export default function NewOrganisationPage() {
  return (
    <PageShell title="Create organisation" icon="domain_add" back={{ href: '/field-entry', label: 'Back' }} description="Set up a shared workspace for your clinic or team." width="max-w-4xl">
      <CreateOrganisationForm />
    </PageShell>
  );
}
