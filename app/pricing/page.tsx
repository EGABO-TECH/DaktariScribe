import Link from 'next/link';
import Image from 'next/image';
import { PRODUCTS, formatUgx } from '@/lib/billing/plans';

export const metadata = {
  title: 'Pricing — DaktariScribe',
  description: 'Prepaid passes in Uganda shillings. Pay with mobile money. Passes never renew automatically.',
};

const PASSES = [
  { code: 'daily', recommended: false },
  { code: 'weekly', recommended: false },
  { code: 'monthly_basic', recommended: false },
  { code: 'monthly_pro', recommended: true },
] as const;

const FEATURE_TEXT: Record<string, string> = {
  pdf: 'PDF reports',
  docx: 'Word documents',
  pptx: 'Slide decks',
  translate_1: 'Reports in one other language',
  translate_all: 'Reports in all supported languages',
  templates: 'All templates',
  insights: 'Insights charts',
  aggregate: 'Reports across many records',
  custom_logo: 'Your organisation’s logo',
  priority: 'Priority support',
};

const FAQ = [
  ['Does it renew automatically?', 'No. Every pass is prepaid and ends on its end date. Nothing is taken from your mobile money without you approving it with your PIN.'],
  ['What happens when my pass ends?', 'You keep your records. You can still sign in, read and export every signed-off record, and capture new notes on your device. Only new processing waits for a new pass.'],
  ['How do I pay?', 'MTN Mobile Money or Airtel Money: enter your number and approve the payment on your phone with your PIN. Card and bank transfer are available through a secure payment page.'],
  ['Can I add more reports?', 'Yes. Top-ups add reports or voice minutes to your active pass and end with it.'],
  ['What about refunds?', 'Contact us. Refunds are handled by our team; small amounts are returned as account credit.'],
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-on-background">
      <header className="flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-margin-mobile py-3 md:px-margin-desktop">
        <Link href="/" className="flex min-h-12 items-center gap-2 font-semibold text-primary">
          <Image src="/assets/report-mark.png" alt="" width={32} height={32} />
          DaktariScribe
        </Link>
        <Link href="/" className="inline-flex min-h-12 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary">
          Sign in
        </Link>
      </header>
      <main id="main" className="mx-auto flex max-w-6xl flex-col gap-10 px-margin-mobile py-10 md:px-margin-desktop">
        <section className="text-center">
          <h1 className="font-display-lg text-display-lg-mobile text-primary md:text-display-lg">Simple prepaid passes</h1>
          <p className="mx-auto mt-2 max-w-2xl text-body-lg text-on-surface-variant">
            Buy a pass with mobile money, like a data bundle. Prices in Uganda shillings. <strong className="text-on-surface">Passes never renew automatically.</strong>
          </p>
          <div className="mx-auto mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-xl border border-secondary bg-success-container p-4 text-on-success-container">
            <span className="font-semibold">
              Free 7-day trial: {PRODUCTS.trial.reports} reports and {PRODUCTS.trial.voiceMin} voice minutes.
            </span>
            <Link href="/register" className="inline-flex min-h-12 items-center rounded-lg bg-secondary px-4 font-semibold text-on-secondary">
              Start free trial
            </Link>
          </div>
        </section>

        <section aria-label="Passes" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASSES.map(({ code, recommended }) => {
            const p = PRODUCTS[code];
            return (
              <article key={code} className={`flex flex-col rounded-xl border bg-surface-container-lowest p-5 ${recommended ? 'border-2 border-secondary' : 'border-outline-variant'}`}>
                {recommended && <p className="mb-2 self-start rounded-full bg-secondary px-2.5 py-0.5 text-[12px] font-semibold text-on-secondary">Recommended</p>}
                <h2 className="font-headline-sm text-headline-sm text-primary">{p.name}</h2>
                <p className="mt-2 font-display-lg text-[28px] font-bold text-on-surface">{formatUgx(p.priceUgx)}</p>
                <p className="text-body-md text-on-surface-variant">
                  {p.days === 1 ? '1 day' : `${p.days} days`} · does not renew
                </p>
                <ul className="mt-4 flex flex-col gap-1.5 text-body-md text-on-surface">
                  <li>
                    <strong>{p.reports}</strong> reports
                  </li>
                  <li>
                    <strong>{p.voiceMin}</strong> voice minutes
                  </li>
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">
                        check
                      </span>
                      {FEATURE_TEXT[f] ?? f}
                    </li>
                  ))}
                </ul>
                <Link href={`/billing/buy?product=${code}`} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-on-primary hover:bg-primary/90">
                  Buy {p.name.toLowerCase()}
                </Link>
              </article>
            );
          })}
        </section>

        <section aria-labelledby="topups" className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 id="topups" className="font-headline-sm text-headline-sm text-primary">
              Top-ups
            </h2>
            <p className="text-body-md text-on-surface-variant">Add to an active pass. They end with the pass.</p>
          </div>
          {(['topup_reports', 'topup_voice'] as const).map((c) => (
            <div key={c} className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
              <span className="font-semibold text-on-surface">{PRODUCTS[c].name}</span>
              <span className="font-semibold text-primary">{formatUgx(PRODUCTS[c].priceUgx)}</span>
            </div>
          ))}
        </section>

        <section aria-labelledby="teams" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
          <h2 id="teams" className="font-headline-sm text-headline-sm text-primary">
            Teams and organisations
          </h2>
          <p className="mt-1 text-body-md text-on-surface">
            {formatUgx(PRODUCTS.team_seat.priceUgx)} per health worker per 30 days, minimum {PRODUCTS.team_seat.minSeats} seats. Includes everything in Monthly Pro, supervisor
            tools and team reports. Pay by mobile money, card, bank transfer or invoice.
          </p>
          <a href="mailto:hello@daktariscribe.com?subject=Team%20plan" className="mt-3 inline-flex min-h-12 items-center rounded-lg border border-primary px-4 font-semibold text-primary hover:bg-primary/5">
            Contact us about a team plan
          </a>
        </section>

        <section aria-labelledby="faq">
          <h2 id="faq" className="mb-3 font-headline-sm text-headline-sm text-primary">
            Questions
          </h2>
          <div className="flex flex-col gap-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rounded-lg border border-outline-variant bg-surface-container-lowest">
                <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-on-surface">{q}</summary>
                <p className="px-4 pb-4 text-body-md text-on-surface">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="text-center text-body-lg font-semibold text-on-surface">We never sell or share patient data.</p>
      </main>
    </div>
  );
}
