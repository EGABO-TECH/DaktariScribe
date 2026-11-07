import Link from 'next/link';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import InsightsCharts from '@/components/insights/InsightsCharts';
import ExportPanel from '@/components/exports/ExportPanel';
import { btn, Card, EmptyState, field, Icon } from '@/components/ui/kit';
import { isDatabaseConfigured } from '@/db';
import { requireAuth } from '@/lib/auth';
import { canViewInsights } from '@/lib/roles';
import { logger } from '@/lib/logger';
import { insightSites, insightsFilter, insightsFor, metricOptions, type InsightsData } from '@/lib/insights';
import { billingEnforced, getActivePass } from '@/lib/billing/entitlements';

export const metadata = { title: 'Insights — DaktariScribe' };

const fieldCls = field.input;
const labelCls = field.label;

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAuth();
  if (!canViewInsights(ctx)) {
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
    <PageShell
      title="Insights"
      icon="bar_chart"
      description="Recorded values from signed-off records only. Figures are counted directly from what was recorded."
    >
      <form method="get" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-[0_1px_2px_rgba(0,29,61,0.04)] md:p-5" role="search" aria-label="Filter insights">
        <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-on-surface">
          <Icon name="tune" className="text-[20px] text-secondary" />
          Choose what to chart
        </div>
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
        <div className="mt-5 border-t border-outline-variant pt-4">
          <button type="submit" className={btn.primary}>
            <Icon name="insights" className="text-[20px]" />
            Update charts
          </button>
        </div>
      </form>

      {!data ? (
        <Card>
          <EmptyState icon="monitoring" title="No recorded values yet">
            Charts appear once records with measured values (such as temperature or test results) are signed off.
          </EmptyState>
        </Card>
      ) : (
        <Card
          icon="monitoring"
          title={data.metric.label}
          description={`${data.total} recorded value${data.total === 1 ? '' : 's'} from signed-off records.`}
        >
          <InsightsCharts data={data} />
        </Card>
      )}

      <Card id="deck" icon="slideshow" title="Build a slide deck" description="Uses the same filters: signed-off records in this date range and site.">
        <ExportPanel scope={{ filter: { from: filter.from, to: filter.to, site: filter.site } }} defaultFormat="pptx" />
      </Card>
    </PageShell>
  );
}
