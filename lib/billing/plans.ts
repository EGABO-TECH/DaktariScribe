/**
 * Prepaid passes in UGX (spec §7.1). Starting prices the owner will tune: keep every number here.
 * Passes NEVER auto-renew. All prices are whole UGX and respect the Nylon Pay minimum (500).
 */
export type Feature =
  | 'pdf' | 'docx' | 'pptx' | 'translate_1' | 'translate_all' | 'templates' | 'insights' | 'aggregate'
  | 'custom_logo' | 'priority' | 'supervisor' | 'team_reports';

type PassProduct = {
  kind: 'pass';
  name: string;
  priceUgx: number;
  days: number;
  reports: number;
  voiceMin: number;
  features: Feature[];
  exportMark?: string;
  perSeat?: boolean;
  minSeats?: number;
};
type TopupProduct = { kind: 'topup'; name: string; priceUgx: number; addReports?: number; addVoiceMin?: number };

const PRO_FEATURES: Feature[] = ['pdf', 'docx', 'pptx', 'translate_all', 'templates', 'insights', 'aggregate', 'custom_logo', 'priority'];

export const PRODUCTS = {
  trial: { kind: 'pass', name: 'Free trial', priceUgx: 0, days: 7, reports: 10, voiceMin: 20, features: ['pdf', 'docx', 'translate_1'], exportMark: 'Trial' },
  daily: { kind: 'pass', name: 'Daily pass', priceUgx: 500, days: 1, reports: 3, voiceMin: 5, features: ['pdf'] },
  weekly: { kind: 'pass', name: 'Weekly pass', priceUgx: 2_000, days: 7, reports: 15, voiceMin: 20, features: ['pdf', 'docx', 'translate_1'] },
  monthly_basic: { kind: 'pass', name: 'Monthly Basic', priceUgx: 5_000, days: 30, reports: 40, voiceMin: 60, features: ['pdf', 'docx', 'translate_all', 'templates'] },
  monthly_pro: { kind: 'pass', name: 'Monthly Pro', priceUgx: 20_000, days: 30, reports: 150, voiceMin: 180, features: PRO_FEATURES },
  pro_quarter: { kind: 'pass', name: 'Pro Quarter', priceUgx: 55_000, days: 90, reports: 450, voiceMin: 540, features: PRO_FEATURES },
  topup_reports: { kind: 'topup', name: 'Top-up: 10 reports', priceUgx: 1_000, addReports: 10 },
  topup_voice: { kind: 'topup', name: 'Top-up: 30 voice minutes', priceUgx: 1_500, addVoiceMin: 30 },
  // Team allowance per seat per 30 days (pooled across the organisation).
  team_seat: { kind: 'pass', name: 'Team seat', priceUgx: 25_000, days: 30, reports: 150, voiceMin: 180, perSeat: true, minSeats: 5, features: [...PRO_FEATURES, 'supervisor', 'team_reports'] },
} as const satisfies Record<string, PassProduct | TopupProduct>;

export type ProductCode = keyof typeof PRODUCTS;
export type PurchasableCode = Exclude<ProductCode, 'trial'>;

export const NYLONPAY_MIN_UGX = 500;
export const PURCHASABLE: PurchasableCode[] = ['daily', 'weekly', 'monthly_basic', 'monthly_pro', 'pro_quarter', 'topup_reports', 'topup_voice', 'team_seat'];

export function product(code: ProductCode) {
  return PRODUCTS[code] as PassProduct | TopupProduct;
}

/** Server-side price: never taken from the client. */
export function priceFor(code: PurchasableCode, seats = 1): number {
  const p = product(code);
  if (p.kind === 'pass' && p.perSeat) return p.priceUgx * Math.max(seats, p.minSeats ?? 1);
  return p.priceUgx;
}

export function formatUgx(n: number): string {
  return `UGX ${new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(n)}`;
}
