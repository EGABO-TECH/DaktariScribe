import Link from 'next/link';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import StatusBadge from '@/components/records/StatusBadge';
import { btn, Card, EmptyState, Icon, StatTile } from '@/components/ui/kit';
import { isDatabaseConfigured } from '@/db';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { listFinalRecords } from '@/lib/records/service';

export const metadata = { title: 'Reports — DaktariScribe' };

type Row = Awaited<ReturnType<typeof listFinalRecords>>[number];

const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const signedFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala' });

function group(rows: Row[]) {
  const months = new Map<string, Map<string, Row[]>>();
  for (const r of rows) {
    const d = new Date(`${r.encounterDate}T00:00:00Z`);
    const m = monthFmt.format(d);
    const day = dayFmt.format(d);
    if (!months.has(m)) months.set(m, new Map());
    const days = months.get(m)!;
    if (!days.has(day)) days.set(day, []);
    days.get(day)!.push(r);
  }
  return months;
}

export default async function ReportsPage() {
  const ctx = await requireAuth();

  if (!isDatabaseConfigured()) {
    return (
      <PageShell title="Reports">
        <ServiceNotice title="Records service unavailable">Reports can&apos;t be shown right now.</ServiceNotice>
      </PageShell>
    );
  }

  let rows: Row[];
  try {
    rows = await listFinalRecords(ctx);
  } catch (err) {
    logger.error('reports.load_failed', { err });
    return (
      <PageShell title="Reports">
        <ServiceNotice title="Reports could not be loaded">Check your connection and reload the page.</ServiceNotice>
      </PageShell>
    );
  }

  const months = group(rows);

  const sites = new Set(rows.map((r) => r.site)).size;
  const thisMonth = rows.filter((r) => r.encounterDate.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;

  return (
    <PageShell
      title="Reports"
      icon="description"
      description="Signed-off records, ready to download as PDF field reports."
      actions={
        <Link href="/saved-records?status=in_review" className={btn.outline}>
          <Icon name="rate_review" className="text-[20px]" />
          Waiting for review
        </Link>
      }
    >
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="description"
            title="No signed-off records yet"
            action={
              <Link href="/saved-records?status=in_review" className={btn.primary}>
                Records waiting for review
              </Link>
            }
          >
            Records appear here once they have been reviewed and signed off.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile label="Signed-off reports" value={rows.length} icon="verified" />
            <StatTile label="This month" value={thisMonth} icon="calendar_month" />
            <StatTile label="Sites covered" value={sites} icon="location_on" />
          </div>
          {[...months.entries()].map(([month, days]) => (
            <section key={month} aria-label={month} className="flex flex-col gap-5">
              <h2 className="sticky top-0 z-10 -mx-1 flex items-center justify-between border-b border-outline-variant bg-surface/95 px-1 py-3 font-display-lg text-headline-md text-primary backdrop-blur">
                {month}
                <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 font-body-md text-[13px] font-semibold text-on-surface-variant">
                  {[...days.values()].reduce((n, d) => n + d.length, 0)} reports
                </span>
              </h2>
              {[...days.entries()].map(([day, items]) => (
                <div key={day} className="flex flex-col gap-3">
                  <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    <Icon name="event" className="text-[18px] text-secondary" />
                    {day}
                  </h3>
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((r) => (
                      <li key={r.id} className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_1px_2px_rgba(0,29,61,0.04)] transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-2 border-b border-outline-variant p-4">
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant">Field report</p>
                            <Link href={`/records/${r.id}`} className="font-label-status text-[13px] font-semibold text-primary break-all hover:underline">
                              {r.id}
                            </Link>
                          </div>
                          <StatusBadge status="final" />
                        </div>
                        <dl className="grid grid-cols-2 gap-3 p-4 text-body-md">
                          <div>
                            <dt className="text-[12px] text-on-surface-variant">Site</dt>
                            <dd className="font-semibold text-on-surface">{r.site}</dd>
                          </div>
                          <div>
                            <dt className="text-[12px] text-on-surface-variant">Template</dt>
                            <dd className="text-on-surface">{r.templateName}</dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-[12px] text-on-surface-variant">Signed off</dt>
                            <dd className="text-on-surface">
                              {r.signerName} · {signedFmt.format(r.signedAt)}
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-auto flex gap-2 border-t border-outline-variant p-3">
                          <a href={`/api/exports/${encodeURIComponent(r.id)}`} className={`${btn.primary} flex-1`}>
                            <Icon name="picture_as_pdf" />
                            Download PDF
                          </a>
                          <Link href={`/records/${r.id}`} aria-label={`Open ${r.id}`} className={`${btn.outline} px-3`}>
                            <Icon name="open_in_new" className="text-[20px]" />
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
