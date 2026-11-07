import React from 'react';
import Link from 'next/link';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import StatusBadge from '@/components/records/StatusBadge';
import { btn, EmptyState, field, Icon, table } from '@/components/ui/kit';
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

const fieldCls = field.input;
const labelCls = field.label;

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
      icon="library_books"
      description={supervisor ? 'All encounters recorded in your organisation.' : 'Encounters you have recorded.'}
      actions={
        <Link href="/field-entry" className={btn.accent}>
          <Icon name="add" className="text-[20px]" />
          New encounter
        </Link>
      }
    >
      {/* Filters: a plain GET form, so it works without JavaScript and the URL is shareable */}
      <form method="get" action="/saved-records" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-[0_1px_2px_rgba(0,29,61,0.04)] md:p-5" role="search" aria-label="Filter records">
        <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-on-surface">
          <Icon name="tune" className="text-[20px] text-secondary" />
          Filter records
          {hasFilters && <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[12px] text-secondary">Filters on</span>}
        </div>
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
        <div className="mt-5 flex flex-wrap gap-3 border-t border-outline-variant pt-4">
          <button type="submit" className={btn.primary}>
            <Icon name="filter_list" className="text-[20px]" />
            Apply filters
          </button>
          {hasFilters && (
            <Link href="/saved-records" className={btn.ghost}>
              <Icon name="close" className="text-[20px]" />
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <section aria-label="Records" className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_1px_2px_rgba(0,29,61,0.04)]">
        {data.rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 md:px-5">
            <p className="font-semibold text-on-surface">
              {data.total} record{data.total === 1 ? '' : 's'}
            </p>
            <p className="text-[13px] text-on-surface-variant">Select a record to open it</p>
          </div>
        )}
        {data.rows.length === 0 ? (
          hasFilters ? (
            <EmptyState icon="search_off" title="No records match these filters" action={<Link href="/saved-records" className={btn.outline}>Clear filters</Link>}>
              Try a wider date range or a different site or status.
            </EmptyState>
          ) : (
            <EmptyState
              icon="folder_open"
              title="No records yet"
              action={
                <Link href="/field-entry" className={btn.accent}>
                  <Icon name="add" className="text-[20px]" />
                  Capture your first encounter
                </Link>
              }
            >
              Records you capture by typing, voice or upload appear here, with their status.
            </EmptyState>
          )
        ) : (
          <>
            {/* Table on larger screens */}
            <div className={`hidden md:block ${table.wrap}`}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th scope="col" className={table.th}>Record ID</th>
                    <th scope="col" className={table.th}>Date</th>
                    <th scope="col" className={table.th}>Site</th>
                    <th scope="col" className={table.th}>Template</th>
                    {supervisor && <th scope="col" className={table.th}>Worker</th>}
                    <th scope="col" className={table.th}>Status</th>
                    <th scope="col" className={table.th}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className={`${table.row} group`}>
                      <td className={table.td}>
                        <Link href={`/records/${r.id}`} className="font-label-status text-[13px] font-semibold text-primary underline-offset-2 hover:underline">
                          {r.id}
                        </Link>
                      </td>
                      <td className={`${table.td} whitespace-nowrap`}>{fmtDate(r.encounterDate)}</td>
                      <td className={table.td}>{r.site}</td>
                      <td className={`${table.td} text-on-surface-variant`}>{r.templateName}</td>
                      {supervisor && <td className={table.td}>{r.workerName}</td>}
                      <td className={table.td}>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className={`${table.td} w-10 text-right`}>
                        <Link href={`/records/${r.id}`} aria-label={`Open ${r.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant group-hover:bg-surface-container-high group-hover:text-primary">
                          <Icon name="chevron_right" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards on phones */}
            <ul className="divide-y divide-outline-variant md:hidden">
              {data.rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/records/${r.id}`} className="flex items-center gap-3 p-4 hover:bg-surface-container-low">
                    <div className="min-w-0 flex-1">
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
                    </div>
                    <Icon name="chevron_right" className="text-on-surface-variant" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {data.total > 0 && (
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-low/50 px-4 py-3 md:px-5">
            <p className="text-body-md text-on-surface-variant">
              Showing <strong className="text-on-surface">{first}</strong>–<strong className="text-on-surface">{last}</strong> of{' '}
              <strong className="text-on-surface">{data.total}</strong>
            </p>
            <div className="flex items-center gap-1">
              {data.page > 1 ? (
                <Link href={pageHref(filters, data.page - 1)} className={btn.outline} rel="prev">
                  <Icon name="chevron_left" />
                  Previous
                </Link>
              ) : null}
              <span className="px-3 text-body-md text-on-surface-variant">
                Page {data.page} of {totalPages}
              </span>
              {data.page < totalPages ? (
                <Link href={pageHref(filters, data.page + 1)} className={btn.outline} rel="next">
                  Next
                  <Icon name="chevron_right" />
                </Link>
              ) : null}
            </div>
          </nav>
        )}
      </section>
    </PageShell>
  );
}
