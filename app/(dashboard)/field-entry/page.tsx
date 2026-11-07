import React from 'react';
import FieldEntry, { type TemplateOption } from '@/components/capture/FieldEntry';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import { isDatabaseConfigured } from '@/db';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { listTemplates } from '@/lib/records/service';
import { GLOBAL_TEMPLATES } from '@/lib/templates/global-templates';

export const metadata = { title: 'Field Entry — DaktariScribe' };

export default async function FieldEntryPage() {
  const ctx = await requireAuth();
  let templates: TemplateOption[] | null = null;
  if (isDatabaseConfigured()) {
    try {
      templates = (await listTemplates(ctx)).map((t) => ({ id: t.id, name: t.name }));
    } catch (err) {
      logger.error('field_entry.templates_failed', { err });
    }
  }
  const degraded = templates === null;
  // Capture must keep working without the server: fall back to the built-in global templates.
  const options = templates ?? GLOBAL_TEMPLATES.map((t) => ({ id: t.id, name: t.name }));

  return (
    <PageShell title="Field Entry" icon="edit_note" width="max-w-5xl" description="Capture an encounter. Drafts are saved on this device as you type.">
      {degraded && (
        <ServiceNotice title="Records service unavailable">
          You can keep typing and saving drafts on this device. Processing will work again once the service is back.
        </ServiceNotice>
      )}
      <FieldEntry templates={options} />
    </PageShell>
  );
}
