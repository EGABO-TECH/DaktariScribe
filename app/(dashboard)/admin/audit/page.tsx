import { desc, eq } from 'drizzle-orm';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import { getDb, isDatabaseConfigured, schema } from '@/db';
import { canSeeWholeOrg, requireAuth } from '@/lib/auth';

export const metadata = { title: 'Audit log — DaktariScribe' };

const ACTIONS: Record<string, string> = {
  'encounter.create': 'Created record',
  'encounter.view': 'Viewed record',
  'encounter.reprocess': 'Re-processed record',
  'encounter.signoff': 'Signed off record',
  'version.create': 'Saved new version',
  'source.uploaded': 'Uploaded original',
  'export.pdf': 'Exported PDF',
  'export.docx': 'Exported Word',
  'export.pptx': 'Exported slides',
  'payment.activated': 'Pass activated',
};

/** Audit log (spec §6.7): supervisors and admins. Entries never contain patient content. */
export default async function AuditPage() {
  const ctx = await requireAuth();
  if (!canSeeWholeOrg(ctx) && !ctx.orgId.startsWith('personal_')) {
    return (
      <PageShell title="Audit log">
        <ServiceNotice title="Supervisors and admins only">Ask your organisation admin for access.</ServiceNotice>
      </PageShell>
    );
  }
  if (!isDatabaseConfigured()) {
    return (
      <PageShell title="Audit log">
        <ServiceNotice title="Unavailable">The records service is not configured.</ServiceNotice>
      </PageShell>
    );
  }
  const rows = await getDb().select().from(schema.auditLog).where(eq(schema.auditLog.orgId, ctx.orgId)).orderBy(desc(schema.auditLog.createdAt)).limit(300);
  const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Africa/Kampala' });
  return (
    <PageShell title="Audit log" description="Who viewed, changed, signed off and exported records. Latest 300 entries.">
      <section className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest">
        <table className="w-full min-w-[640px] text-left text-body-md">
          <thead className="bg-surface-container-low">
            <tr className="border-b border-outline-variant">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Record / item</th>
              <th className="px-4 py-3">User ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-outline-variant/60">
                <td className="px-4 py-2 whitespace-nowrap">{fmt.format(r.createdAt)}</td>
                <td className="px-4 py-2">{ACTIONS[r.action] ?? r.action}</td>
                <td className="px-4 py-2 font-label-status text-[12px]">{r.entityId}</td>
                <td className="px-4 py-2 font-label-status text-[12px]">{r.actorId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-on-surface-variant">No entries yet.</p>}
      </section>
    </PageShell>
  );
}
