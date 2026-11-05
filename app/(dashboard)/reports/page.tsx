import Link from 'next/link';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import StatusBadge from '@/components/records/StatusBadge';
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

  return (
    <PageShell title="Reports" description="Signed-off records, ready to download as PDF field reports.">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-on-surface-variant" aria-hidden="true">
            description
          </span>
          <p className="mt-2 font-semibold text-on-surface">No signed-off records yet.</p>
          <p className="mt-1 text-body-md text-on-surface-variant">Records appear here once they have been reviewed and signed off.</p>
          <Link href="/saved-records?status=in_review" className="mt-3 inline-flex min-h-12 items-center rounded-lg px-4 font-semibold text-secondary hover:bg-secondary/10">
            Records waiting for review
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {[...months.entries()].map(([month, days]) => (
            <section key={month} aria-label={month} className="flex flex-col gap-6">
              <h2 className="sticky top-0 z-10 border-b-2 border-secondary/30 bg-surface py-3 font-display-lg text-headline-md text-primary">{month}</h2>
              {[...days.entries()].map(([day, items]) => (
                <div key={day} className="flex flex-col gap-3">
                  <h3 className="flex items-center gap-3 text-[13px] font-bold uppercase tracking-widest text-secondary">
                    <span aria-hidden="true" className="h-px flex-1 bg-outline-variant" />
                    {day}
                    <span aria-hidden="true" className="h-px flex-1 bg-outline-variant" />
                  </h3>
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((r) => (
                      <li key={r.id} className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest">
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
                        <div className="mt-auto border-t border-outline-variant p-3">
                          <a
                            href={`/api/exports/${encodeURIComponent(r.id)}`}
                            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-semibold text-on-primary hover:bg-primary/90"
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              picture_as_pdf
                            </span>
                            Download PDF
                          </a>
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
