import PageShell from '@/components/layout/PageShell';
import BuyFlow from '@/components/billing/BuyFlow';
import { requireAuth } from '@/lib/auth';
import { PURCHASABLE, PRODUCTS, type PurchasableCode } from '@/lib/billing/plans';
import { nylonPayConfigured } from '@/lib/billing/nylonpay';
import ServiceNotice from '@/components/layout/ServiceNotice';

export const metadata = { title: 'Buy a pass — DaktariScribe' };

export default async function BuyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAuth();
  const sp = await searchParams;
  const requested = (Array.isArray(sp.product) ? sp.product[0] : sp.product) as PurchasableCode | undefined;
  const initial = requested && PURCHASABLE.includes(requested) ? requested : 'weekly';
  const products = PURCHASABLE.filter((c) => c !== 'team_seat' || (ctx.role === 'admin' && !ctx.orgId.startsWith('personal_'))).map((c) => {
    const p = PRODUCTS[c];
    return {
      code: c,
      name: p.name,
      priceUgx: p.priceUgx,
      detail:
        p.kind === 'topup'
          ? 'addReports' in p
            ? `+${p.addReports} reports on your active pass`
            : `+${p.addVoiceMin} voice minutes on your active pass`
          : `${p.days === 1 ? '1 day' : `${p.days} days`} · ${p.reports} reports · ${p.voiceMin} voice min${'perSeat' in p ? ' per seat' : ''}`,
      perSeat: 'perSeat' in p,
    };
  });

  return (
    <PageShell title="Buy a pass" icon="shopping_cart" back={{ href: '/billing', label: 'Billing' }} width="max-w-3xl" description="Prepaid. Does not renew automatically.">
      {nylonPayConfigured() ? <BuyFlow products={products} initial={initial} /> : <ServiceNotice title="Payments are not set up yet">Ask the administrator to add the Nylon Pay keys.</ServiceNotice>}
    </PageShell>
  );
}
