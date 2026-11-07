import { desc, eq } from 'drizzle-orm';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import { Card, EmptyState, table } from '@/components/ui/kit';
import { getDb, isDatabaseConfigured, schema } from '@/db';
import { requireAuth } from '@/lib/auth';
import { canViewAudit } from '@/lib/roles';

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
  if (!canViewAudit(ctx)) {
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
    <PageShell title="Audit log" icon="history" description="Who viewed, changed, signed off and exported records. Latest 300 entries.">
      <Card id="audit" icon="manage_search" title="Activity" description={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} · times in East Africa Time`} padded={!rows.length}>
        {!rows.length ? (
          <EmptyState icon="history" title="No entries yet">
            Views, edits, sign-offs and exports are recorded here automatically.
          </EmptyState>
        ) : (
          <div className={table.wrap}>
            <table className={`${table.table} min-w-[640px]`}>
              <thead className={table.head}>
                <tr>
                  <th scope="col" className={table.th}>Time</th>
                  <th scope="col" className={table.th}>Action</th>
                  <th scope="col" className={table.th}>Record / item</th>
                  <th scope="col" className={table.th}>User ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={table.row}>
                    <td className={`${table.td} whitespace-nowrap text-on-surface-variant`}>{fmt.format(r.createdAt)}</td>
                    <td className={`${table.td} font-semibold`}>{ACTIONS[r.action] ?? r.action}</td>
                    <td className={`${table.td} font-label-status text-[12px]`}>{r.entityId}</td>
                    <td className={`${table.td} font-label-status text-[12px] text-on-surface-variant`}>{r.actorId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
