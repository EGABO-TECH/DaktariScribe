import Link from 'next/link';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import TrialClaim from '@/components/billing/TrialClaim';
import { isDatabaseConfigured } from '@/db';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { billingAccount } from '@/lib/billing/account';
import { formatUgx } from '@/lib/billing/plans';

export const metadata = { title: 'Billing — DaktariScribe' };

const dt = (d: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala' }).format(d);

const STATUS: Record<string, { label: string; icon: string; cls: string }> = {
  successful: { label: 'Paid', icon: 'check_circle', cls: 'text-secondary' },
  pending: { label: 'Waiting', icon: 'schedule', cls: 'text-on-surface-variant' },
  processing: { label: 'Processing', icon: 'hourglass_top', cls: 'text-on-surface-variant' },
  failed: { label: 'Failed', icon: 'error', cls: 'text-error' },
  cancelled: { label: 'Cancelled', icon: 'cancel', cls: 'text-on-surface-variant' },
};

function Meter({ label, left, total }: { label: string; left: number; total: number }) {
  const used = total ? Math.round(((total - left) / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-body-md">
        <span className="font-semibold text-on-surface">{label}</span>
        <span className="text-on-surface">
          <strong>{left}</strong> of {total} left
        </span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface-container-high" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={left}>
        <div className={`h-full rounded-full ${used >= 80 ? 'bg-flag' : 'bg-secondary'}`} style={{ width: `${100 - used}%` }} />
      </div>
    </div>
  );
}

export default async function BillingPage() {
  const ctx = await requireAuth();
  if (!isDatabaseConfigured()) {
    return (
      <PageShell title="Billing">
        <ServiceNotice title="Billing unavailable">Please try again later.</ServiceNotice>
      </PageShell>
    );
  }
  let acc: Awaited<ReturnType<typeof billingAccount>>;
  try {
    acc = await billingAccount(ctx);
  } catch (err) {
    logger.error('billing.load_failed', { err });
    return (
      <PageShell title="Billing">
        <ServiceNotice title="Billing could not be loaded">Check your connection and reload the page.</ServiceNotice>
      </PageShell>
    );
  }

  return (
    <PageShell title="Billing" width="max-w-4xl" description="Prepaid passes. Nothing renews automatically.">
      {!acc.enforced && <ServiceNotice title="Payments are not switched on for this installation">All features are available without a pass.</ServiceNotice>}

      <section aria-labelledby="pass-h" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
        <h2 id="pass-h" className="font-headline-sm text-headline-sm text-primary">
          Current pass
        </h2>
        {acc.pass ? (
          <div className="mt-3 flex flex-col gap-4">
            <p className="text-body-lg text-on-surface">
              <strong>{acc.pass.name}</strong> · ends {dt(acc.pass.endsAt)} · does not renew
            </p>
            {acc.pass.warnings.length > 0 && (
              <p role="status" className="rounded-lg border border-flag bg-flag-container p-3 text-[14px] font-semibold text-on-flag-container">
                {acc.pass.warnings.includes('last_day')
                  ? 'Your pass ends within a day.'
                  : acc.pass.warnings.includes('expires_2_days')
                    ? 'Your pass ends in 2 days.'
                    : 'You have used most of this pass.'}{' '}
                Your records stay available when it ends.
              </p>
            )}
            <Meter label="Reports" left={acc.pass.reportsLeft} total={acc.pass.reportsTotal} />
            <Meter label="Voice minutes" left={acc.pass.voiceMinutesLeft} total={acc.pass.voiceMinutesTotal} />
          </div>
        ) : (
          <p className="mt-2 text-body-md text-on-surface">No active pass. You can still open and export every signed-off record and capture notes; processing new notes needs a pass.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/billing/buy" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-on-primary hover:bg-primary/90">
            {acc.pass ? 'Extend, upgrade or top up' : 'Buy a pass'}
          </Link>
          <Link href="/pricing" className="inline-flex min-h-12 items-center rounded-lg px-4 font-semibold text-secondary hover:bg-secondary/10">
            Compare passes
          </Link>
        </div>
      </section>

      {!acc.trialUsed && !acc.pass && acc.enforced && <TrialClaim defaultPhone="" />}

      <section aria-labelledby="pay-h" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
        <h2 id="pay-h" className="mb-3 font-headline-sm text-headline-sm text-primary">
          Payment history
        </h2>
        {acc.payments.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {acc.payments.map((p) => {
              const s = STATUS[p.status] ?? STATUS.pending;
              return (
                <li key={p.reference} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-semibold text-on-surface">
                      {p.product} · {formatUgx(p.amountUgx)}
                    </p>
                    <p className="text-[13px] text-on-surface-variant">
                      {dt(p.createdAt)} · {p.method === 'mobileMoney' ? 'Mobile money' : 'Card / bank'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[14px] font-semibold ${s.cls}`}>
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        {s.icon}
                      </span>
                      {s.label}
                    </span>
                    {p.status === 'successful' && (
                      <a href={`/api/billing/receipts/${p.reference}`} className="min-h-12 rounded-lg px-3 py-3 font-semibold text-secondary hover:bg-secondary/10">
                        Receipt
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
