import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import { isDatabaseConfigured } from '@/db';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { costReport } from '@/lib/billing/costs';
import { formatUgx } from '@/lib/billing/plans';

export const metadata = { title: 'Costs — DaktariScribe' };

export default async function CostsPage() {
  const ctx = await requireAuth();
  const personal = ctx.orgId.startsWith('personal_');
  if (ctx.role !== 'admin' && !personal) {
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
    <PageShell title="Costs" description={`Revenue and processing costs, last ${r.days} days. Costs are estimates from provider rates.`}>
      {alerts.length > 0 && (
        <p role="alert" className="rounded-lg border border-flag bg-flag-container p-3 font-semibold text-on-flag-container">
          Margin below 20% if fully used: {alerts.map((a) => a.name).join(', ')}.
        </p>
      )}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
        {[
          ['Revenue', formatUgx(r.totals.revenueUgx)],
          ['Processing cost', formatUgx(r.totals.costUgx)],
          ['Margin', margin === null ? '—' : `${margin}%`],
          ['Avg cost per report', `${formatUgx(r.avgCostPerReportUgx.typed)} typed · ${formatUgx(r.avgCostPerReportUgx.voice)} voice`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
            <p className="text-[13px] font-semibold text-on-surface-variant">{k}</p>
            <p className="mt-1 text-[20px] font-bold text-on-surface">{v}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="prod-h" className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <h2 id="prod-h" className="mb-2 font-headline-sm text-headline-sm text-primary">
          Products
        </h2>
        <table className="w-full min-w-[560px] text-left text-body-md">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="py-2">Product</th>
              <th className="py-2">Price</th>
              <th className="py-2">Cost if fully used</th>
              <th className="py-2">Margin</th>
            </tr>
          </thead>
          <tbody>
            {r.products.map((p) => (
              <tr key={p.code} className="border-b border-outline-variant/60">
                <td className="py-1.5">{p.name}</td>
                <td className="py-1.5">{formatUgx(p.priceUgx)}</td>
                <td className="py-1.5">{formatUgx(p.fullUseCostUgx)}</td>
                <td className={`py-1.5 font-semibold ${p.alert ? 'text-error' : ''}`}>
                  {Math.round(p.margin * 100)}%{p.alert ? ' · below 20%' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="day-h" className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <h2 id="day-h" className="mb-2 font-headline-sm text-headline-sm text-primary">
          By day
        </h2>
        {r.byDay.length === 0 ? (
          <p className="text-on-surface-variant">No activity yet.</p>
        ) : (
          <table className="w-full min-w-[420px] text-left text-body-md">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="py-2">Day</th>
                <th className="py-2">Revenue</th>
                <th className="py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {r.byDay.map((d) => (
                <tr key={d.day} className="border-b border-outline-variant/60">
                  <td className="py-1.5">{d.day}</td>
                  <td className="py-1.5">{formatUgx(d.revenueUgx)}</td>
                  <td className="py-1.5">{formatUgx(d.costUgx)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="user-h" className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
        <h2 id="user-h" className="mb-2 font-headline-sm text-headline-sm text-primary">
          By user
        </h2>
        <table className="w-full min-w-[480px] text-left text-body-md">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="py-2">User ID</th>
              <th className="py-2">Reports</th>
              <th className="py-2">Revenue</th>
              <th className="py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {r.byUser.map((x) => (
              <tr key={x.userId} className="border-b border-outline-variant/60">
                <td className="py-1.5 font-label-status text-[12px]">{x.userId}</td>
                <td className="py-1.5">{x.reports}</td>
                <td className="py-1.5">{formatUgx(x.revenueUgx)}</td>
                <td className="py-1.5">{formatUgx(x.costUgx)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PageShell>
  );
}
