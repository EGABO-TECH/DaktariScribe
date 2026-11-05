import React from 'react';
import Link from 'next/link';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import StatusBadge from '@/components/records/StatusBadge';
import { isDatabaseConfigured } from '@/db';
import { canSeeWholeOrg, requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { listEncounters, listFilterOptions, listFiltersInput, type ListFilters } from '@/lib/records/service';

export const metadata = { title: 'Saved Records — DaktariScribe' };

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'in_review', label: 'Ready for review' },
  { value: 'final', label: 'Final' },
  { value: 'processing', label: 'Processing' },
  { value: 'draft', label: 'Draft' },
];

const fieldCls =
  'w-full min-h-12 rounded-lg border border-outline bg-surface-container-lowest px-3 text-[16px] text-on-surface focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30';
const labelCls = 'block text-[13px] font-semibold text-on-surface mb-1';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

function pageHref(filters: ListFilters, page: number) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v && k !== 'page') p.set(k, String(v));
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return s ? `/saved-records?${s}` : '/saved-records';
}

export default async function SavedRecordsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAuth();
  const raw = await searchParams;
  const flat = Object.fromEntries(
    Object.entries(raw)
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
      .filter(([, v]) => v !== undefined && v !== ''),
  );
  const parsed = listFiltersInput.safeParse(flat);
  const filters: ListFilters = parsed.success ? parsed.data : { page: 1 };
  const supervisor = canSeeWholeOrg(ctx);

  if (!isDatabaseConfigured()) {
    return (
      <PageShell title="Saved Records">
        <ServiceNotice title="Records service unavailable">Saved records can&apos;t be shown right now. Please try again later.</ServiceNotice>
      </PageShell>
    );
  }

  let data: Awaited<ReturnType<typeof listEncounters>>;
  let options: Awaited<ReturnType<typeof listFilterOptions>>;
  try {
    [data, options] = await Promise.all([listEncounters(ctx, filters), listFilterOptions(ctx)]);
  } catch (err) {
    logger.error('saved_records.load_failed', { err });
    return (
      <PageShell title="Saved Records">
        <ServiceNotice title="Records could not be loaded">Check your connection and reload the page.</ServiceNotice>
      </PageShell>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const first = data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = Math.min(data.page * data.pageSize, data.total);
  const hasFilters = Boolean(filters.q || filters.from || filters.to || filters.site || filters.status || filters.worker);

  return (
    <PageShell
      title="Saved Records"
      description={supervisor ? 'All encounters recorded in your organisation.' : 'Encounters you have recorded.'}
    >
      {/* Filters: a plain GET form, so it works without JavaScript and the URL is shareable */}
      <form method="get" action="/saved-records" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4" role="search" aria-label="Filter records">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label htmlFor="q" className={labelCls}>
              Record ID
            </label>
            <input id="q" name="q" defaultValue={filters.q} placeholder="e.g. DS-2026-05" className={fieldCls} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="from" className={labelCls}>
              From
            </label>
            <input id="from" name="from" type="date" defaultValue={filters.from} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="to" className={labelCls}>
              To
            </label>
            <input id="to" name="to" type="date" defaultValue={filters.to} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="site" className={labelCls}>
              Site
            </label>
            <select id="site" name="site" defaultValue={filters.site ?? ''} className={fieldCls}>
              <option value="">All sites</option>
              {options.sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status" className={labelCls}>
              Status
            </label>
            <select id="status" name="status" defaultValue={filters.status ?? ''} className={fieldCls}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {supervisor && (
            <div className="lg:col-span-2">
              <label htmlFor="worker" className={labelCls}>
                Worker
              </label>
              <select id="worker" name="worker" defaultValue={filters.worker ?? ''} className={fieldCls}>
                <option value="">All workers</option>
                {options.workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-on-primary hover:bg-primary/90">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              filter_list
            </span>
            Apply filters
          </button>
          {hasFilters && (
            <Link href="/saved-records" className="inline-flex min-h-12 items-center rounded-lg px-4 font-semibold text-secondary hover:bg-secondary/10">
              Clear
            </Link>
          )}
        </div>
      </form>

      <section aria-label="Records" className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
        {data.rows.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant" aria-hidden="true">
              folder_open
            </span>
            <p className="mt-2 font-semibold text-on-surface">{hasFilters ? 'No records match these filters.' : 'No records yet.'}</p>
            {!hasFilters && (
              <Link href="/field-entry" className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-lg bg-secondary px-5 font-semibold text-on-secondary">
                Capture an encounter
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Table on larger screens */}
            <table className="hidden w-full border-collapse text-left md:table">
              <thead className="bg-surface-container-low">
                <tr className="border-b border-outline-variant text-[13px] text-on-surface">
                  <th scope="col" className="px-4 py-3 font-semibold">Record ID</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Site</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Template</th>
                  {supervisor && <th scope="col" className="px-4 py-3 font-semibold">Worker</th>}
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low">
                    <td className="px-4 py-3">
                      <Link href={`/records/${r.id}`} className="font-label-status text-[13px] font-semibold text-primary underline-offset-2 hover:underline">
                        {r.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-body-md text-on-surface">{fmtDate(r.encounterDate)}</td>
                    <td className="px-4 py-3 text-body-md text-on-surface">{r.site}</td>
                    <td className="px-4 py-3 text-body-md text-on-surface-variant">{r.templateName}</td>
                    {supervisor && <td className="px-4 py-3 text-body-md text-on-surface">{r.workerName}</td>}
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Cards on phones */}
            <ul className="divide-y divide-outline-variant md:hidden">
              {data.rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/records/${r.id}`} className="block p-4 hover:bg-surface-container-low">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-label-status text-[13px] font-semibold text-primary break-all">{r.id}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-1 text-body-md text-on-surface">
                      {r.site} · {fmtDate(r.encounterDate)}
                    </p>
                    <p className="text-[13px] text-on-surface-variant">
                      {r.templateName}
                      {supervisor ? ` · ${r.workerName}` : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {data.total > 0 && (
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant px-4 py-3">
            <p className="text-body-md text-on-surface-variant">
              Showing <strong className="text-on-surface">{first}</strong>–<strong className="text-on-surface">{last}</strong> of{' '}
              <strong className="text-on-surface">{data.total}</strong>
            </p>
            <div className="flex items-center gap-2">
              {data.page > 1 ? (
                <Link href={pageHref(filters, data.page - 1)} className="inline-flex min-h-12 items-center gap-1 rounded-lg px-3 font-semibold text-primary hover:bg-surface-container-high" rel="prev">
                  <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                  Previous
                </Link>
              ) : null}
              <span className="px-2 text-body-md text-on-surface-variant">
                Page {data.page} of {totalPages}
              </span>
              {data.page < totalPages ? (
                <Link href={pageHref(filters, data.page + 1)} className="inline-flex min-h-12 items-center gap-1 rounded-lg px-3 font-semibold text-primary hover:bg-surface-container-high" rel="next">
                  Next
                  <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                </Link>
              ) : null}
            </div>
          </nav>
        )}
      </section>
    </PageShell>
  );
}
