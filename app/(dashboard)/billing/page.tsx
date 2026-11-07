import Link from 'next/link';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import TrialClaim from '@/components/billing/TrialClaim';
import { Alert, btn, Card, EmptyState, Icon } from '@/components/ui/kit';
import DownloadButton from '@/components/ui/DownloadButton';
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
    <div className="rounded-lg border border-outline-variant p-4">
      <div className="flex items-baseline justify-between gap-2 text-body-md">
        <span className="font-semibold text-on-surface">{label}</span>
        <span className="text-on-surface-variant">
          <strong className="font-display-lg text-[20px] text-on-surface">{left}</strong> of {total} left
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-container-high" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={left}>
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
    <PageShell title="Billing" icon="confirmation_number" width="max-w-4xl" description="Prepaid passes. Nothing renews automatically.">
      {!acc.enforced && (
        <Alert tone="info" title="Payments are not switched on for this installation">
          All features are available without a pass.
        </Alert>
      )}

      <Card
        id="pass"
        icon="workspace_premium"
        title="Current pass"
        description={acc.pass ? `Ends ${dt(acc.pass.endsAt)} · does not renew` : 'No active pass'}
        actions={
          <>
            <Link href="/pricing" className={btn.ghost}>
              Compare passes
            </Link>
            <Link href="/billing/buy" className={btn.primary}>
              <Icon name={acc.pass ? 'upgrade' : 'shopping_cart'} className="text-[20px]" />
              {acc.pass ? 'Extend, upgrade or top up' : 'Buy a pass'}
            </Link>
          </>
        }
      >
        {acc.pass ? (
          <div className="flex flex-col gap-5">
            <p className="font-headline-sm text-[22px] font-bold text-on-surface">{acc.pass.name}</p>
            {acc.pass.warnings.length > 0 && (
              <Alert tone="warning" role="status">
                {acc.pass.warnings.includes('last_day')
                  ? 'Your pass ends within a day.'
                  : acc.pass.warnings.includes('expires_2_days')
                    ? 'Your pass ends in 2 days.'
                    : 'You have used most of this pass.'}{' '}
                Your records stay available when it ends.
              </Alert>
            )}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Meter label="Reports" left={acc.pass.reportsLeft} total={acc.pass.reportsTotal} />
              <Meter label="Voice minutes" left={acc.pass.voiceMinutesLeft} total={acc.pass.voiceMinutesTotal} />
            </div>
          </div>
        ) : (
          <p className="text-body-md text-on-surface">
            You can still open and export every signed-off record and capture notes; processing new notes needs a pass.
          </p>
        )}
      </Card>

      {!acc.trialUsed && !acc.pass && acc.enforced && <TrialClaim defaultPhone="" />}

      <Card id="payments" icon="receipt_long" title="Payment history" padded={acc.payments.length === 0}>
        {acc.payments.length === 0 ? (
          <EmptyState icon="receipt_long" title="No payments yet">
            Receipts for passes and top-ups will appear here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {acc.payments.map((p) => {
              const s = STATUS[p.status] ?? STATUS.pending;
              return (
                <li key={p.reference} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6">
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
                      <DownloadButton href={`/api/billing/receipts/${p.reference}`} fallbackName="DaktariScribe-receipt.pdf" className={btn.ghost}>
                        Receipt
                      </DownloadButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
