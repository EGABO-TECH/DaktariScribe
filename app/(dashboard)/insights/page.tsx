import Link from 'next/link';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import InsightsCharts from '@/components/insights/InsightsCharts';
import ExportPanel from '@/components/exports/ExportPanel';
import { isDatabaseConfigured } from '@/db';
import { canSeeWholeOrg, requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { insightSites, insightsFilter, insightsFor, metricOptions, type InsightsData } from '@/lib/insights';
import { billingEnforced, getActivePass } from '@/lib/billing/entitlements';

export const metadata = { title: 'Insights — DaktariScribe' };

const fieldCls = 'w-full min-h-12 rounded-lg border border-outline bg-surface-container-lowest px-3 text-[16px] text-on-surface';
const labelCls = 'mb-1 block text-[13px] font-semibold text-on-surface';

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAuth();
  if (!canSeeWholeOrg(ctx)) {
    return (
      <PageShell title="Insights">
        <ServiceNotice title="Insights are for supervisors">Ask your organisation admin to give you the supervisor role to see team charts.</ServiceNotice>
      </PageShell>
    );
  }
  if (!isDatabaseConfigured()) {
    return (
      <PageShell title="Insights">
        <ServiceNotice title="Records service unavailable">Insights can&apos;t be shown right now.</ServiceNotice>
      </PageShell>
    );
  }
  if (billingEnforced()) {
    const p = await getActivePass(ctx.userId, ctx.orgId);
    if (!p?.features.includes('insights')) {
      return (
        <PageShell title="Insights">
          <ServiceNotice title="Insights need a Monthly Pro or team pass">
            <Link href="/billing" className="font-semibold underline">
              See passes
            </Link>
          </ServiceNotice>
        </PageShell>
      );
    }
  }

  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  const parsed = insightsFilter.safeParse(raw);
  const filter = parsed.success ? parsed.data : {};

  let options: Awaited<ReturnType<typeof metricOptions>> = [];
  let sites: string[] = [];
  let data: InsightsData | null = null;
  try {
    [options, sites] = await Promise.all([metricOptions(ctx), insightSites(ctx)]);
    const metric = options.find((o) => o.key === filter.field) ?? options[0];
    if (metric) data = await insightsFor(ctx, filter, metric);
  } catch (err) {
    logger.error('insights.load_failed', { err });
    return (
      <PageShell title="Insights">
        <ServiceNotice title="Insights could not be loaded">Check your connection and reload the page.</ServiceNotice>
      </PageShell>
    );
  }

  return (
    <PageShell title="Insights" description="Recorded values from signed-off records only. Figures are counted directly from what was recorded.">
      <form method="get" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4" role="search" aria-label="Filter insights">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="field" className={labelCls}>
              Measure
            </label>
            <select id="field" name="field" defaultValue={data?.metric.key ?? ''} className={fieldCls}>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from" className={labelCls}>
              From
            </label>
            <input id="from" name="from" type="date" defaultValue={filter.from} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="to" className={labelCls}>
              To
            </label>
            <input id="to" name="to" type="date" defaultValue={filter.to} className={fieldCls} />
          </div>
          <div>
            <label htmlFor="site" className={labelCls}>
              Site
            </label>
            <select id="site" name="site" defaultValue={filter.site ?? ''} className={fieldCls}>
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-on-primary hover:bg-primary/90">
          Apply filters
        </button>
      </form>

      {!data ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <p className="font-semibold text-on-surface">No recorded values yet.</p>
          <p className="mt-1 text-body-md text-on-surface-variant">Charts appear once records with measured values (such as temperature or test results) are signed off.</p>
        </div>
      ) : (
        <>
          <p className="text-body-md text-on-surface-variant">
            {data.total} recorded value(s) for <strong className="text-on-surface">{data.metric.label}</strong>.
          </p>
          <InsightsCharts data={data} />
        </>
      )}

      <section aria-labelledby="deck-h" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
        <h2 id="deck-h" className="mb-3 font-headline-sm text-headline-sm text-primary">
          Build deck
        </h2>
        <p className="mb-3 text-body-md text-on-surface-variant">Uses the same filters: signed-off records in this date range and site.</p>
        <ExportPanel scope={{ filter: { from: filter.from, to: filter.to, site: filter.site } }} defaultFormat="pptx" />
      </section>
    </PageShell>
  );
}
