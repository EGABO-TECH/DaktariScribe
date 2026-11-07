import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import { Alert, Card, EmptyState, StatTile, table } from '@/components/ui/kit';
import { isDatabaseConfigured } from '@/db';
import { requireAuth } from '@/lib/auth';
import { canViewCosts } from '@/lib/roles';
import { logger } from '@/lib/logger';
import { costReport } from '@/lib/billing/costs';
import { formatUgx } from '@/lib/billing/plans';

export const metadata = { title: 'Costs — DaktariScribe' };

export default async function CostsPage() {
  const ctx = await requireAuth();
  if (!canViewCosts(ctx)) {
    return (
      <PageShell title="Costs">
        <ServiceNotice title="Admins only">This page is available to organisation admins.</ServiceNotice>
      </PageShell>
    );
  }
  if (!isDatabaseConfigured()) {
    return (
      <PageShell title="Costs">
        <ServiceNotice title="Unavailable">The records service is not configured.</ServiceNotice>
      </PageShell>
    );
  }
  let r: Awaited<ReturnType<typeof costReport>>;
  try {
    r = await costReport(ctx, 30);
  } catch (err) {
    logger.error('costs.load_failed', { err });
    return (
      <PageShell title="Costs">
        <ServiceNotice title="Costs could not be loaded">Reload the page.</ServiceNotice>
      </PageShell>
    );
  }
  const margin = r.totals.revenueUgx ? Math.round(((r.totals.revenueUgx - r.totals.costUgx) / r.totals.revenueUgx) * 100) : null;
  const alerts = r.products.filter((p) => p.alert);

  return (
    <PageShell title="Costs" icon="payments" description={`Revenue and processing costs, last ${r.days} days. Costs are estimates from provider rates.`}>
      {alerts.length > 0 && (
        <Alert tone="warning" title="Margin below 20% if fully used">
          {alerts.map((a) => a.name).join(', ')}.
        </Alert>
      )}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
        <StatTile label="Revenue" value={formatUgx(r.totals.revenueUgx)} icon="trending_up" />
        <StatTile label="Processing cost" value={formatUgx(r.totals.costUgx)} icon="memory" />
        <StatTile label="Margin" value={margin === null ? '—' : `${margin}%`} icon="percent" />
        <StatTile
          label="Avg cost per report"
          value={formatUgx(r.avgCostPerReportUgx.typed)}
          hint={`typed · ${formatUgx(r.avgCostPerReportUgx.voice)} voice`}
          icon="description"
        />
      </section>

      <Card id="products" icon="sell" title="Products" padded={false}>
        <div className={table.wrap}>
          <table className={`${table.table} min-w-[560px]`}>
            <thead className={table.head}>
              <tr>
                <th scope="col" className={table.th}>Product</th>
                <th scope="col" className={table.th}>Price</th>
                <th scope="col" className={table.th}>Cost if fully used</th>
                <th scope="col" className={table.th}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {r.products.map((p) => (
                <tr key={p.code} className={table.row}>
                  <td className={`${table.td} font-semibold`}>{p.name}</td>
                  <td className={table.td}>{formatUgx(p.priceUgx)}</td>
                  <td className={table.td}>{formatUgx(p.fullUseCostUgx)}</td>
                  <td className={`${table.td} font-semibold ${p.alert ? 'text-error' : 'text-secondary'}`}>
                    {Math.round(p.margin * 100)}%{p.alert ? ' · below 20%' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card id="by-day" icon="calendar_month" title="By day" padded={r.byDay.length === 0}>
          {r.byDay.length === 0 ? (
            <EmptyState icon="calendar_month" title="No activity yet" />
          ) : (
            <div className={table.wrap}>
              <table className={`${table.table} min-w-[360px]`}>
                <thead className={table.head}>
                  <tr>
                    <th scope="col" className={table.th}>Day</th>
                    <th scope="col" className={table.th}>Revenue</th>
                    <th scope="col" className={table.th}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byDay.map((d) => (
                    <tr key={d.day} className={table.row}>
                      <td className={`${table.td} whitespace-nowrap`}>{d.day}</td>
                      <td className={table.td}>{formatUgx(d.revenueUgx)}</td>
                      <td className={table.td}>{formatUgx(d.costUgx)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card id="by-user" icon="group" title="By user" padded={r.byUser.length === 0}>
          {r.byUser.length === 0 ? (
            <EmptyState icon="group" title="No activity yet" />
          ) : (
            <div className={table.wrap}>
              <table className={`${table.table} min-w-[420px]`}>
                <thead className={table.head}>
                  <tr>
                    <th scope="col" className={table.th}>User ID</th>
                    <th scope="col" className={table.th}>Reports</th>
                    <th scope="col" className={table.th}>Revenue</th>
                    <th scope="col" className={table.th}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byUser.map((x) => (
                    <tr key={x.userId} className={table.row}>
                      <td className={`${table.td} font-label-status text-[12px]`}>{x.userId}</td>
                      <td className={table.td}>{x.reports}</td>
                      <td className={table.td}>{formatUgx(x.revenueUgx)}</td>
                      <td className={table.td}>{formatUgx(x.costUgx)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
