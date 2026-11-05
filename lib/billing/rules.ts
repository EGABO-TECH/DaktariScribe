/**
 * Pure entitlement rules (spec §7.2). No I/O: easy to test and reason about.
 */
import { PRODUCTS, product, type Feature, type ProductCode } from './plans';

export type PassState = {
  productCode: ProductCode;
  startsAt: Date;
  endsAt: Date;
  reportsTotal: number;
  reportsUsed: number;
  voiceSecondsTotal: number;
  voiceSecondsUsed: number;
  features: Feature[];
};

const DAY = 24 * 3600 * 1000;

export function isActive(p: PassState | null | undefined, now = new Date()): p is PassState {
  return !!p && p.startsAt <= now && now < p.endsAt;
}

export function reportsLeft(p: PassState): number {
  return Math.max(0, p.reportsTotal - p.reportsUsed);
}
export function voiceSecondsLeft(p: PassState): number {
  return Math.max(0, p.voiceSecondsTotal - p.voiceSecondsUsed);
}

export class EntitlementError extends Error {
  status = 402 as const;
  constructor(public code: 'NO_PASS' | 'NO_REPORTS' | 'NO_VOICE' | 'TOPUP_NEEDS_PASS' | 'FEATURE', message: string) {
    super(message);
    this.name = 'EntitlementError';
  }
}

/** Result of a purchase: the pass to save and, for an upgrade, when the old pass ends. */
export type PurchaseResult = { pass: PassState; closePrevious: boolean };

export function applyPurchase(active: PassState | null, code: Exclude<ProductCode, 'trial'>, now = new Date(), seats = 1): PurchaseResult {
  const p = product(code);
  if (p.kind === 'topup') {
    if (!isActive(active, now)) throw new EntitlementError('TOPUP_NEEDS_PASS', 'Top-ups need an active pass.');
    return {
      pass: {
        ...active,
        reportsTotal: active.reportsTotal + (p.addReports ?? 0),
        voiceSecondsTotal: active.voiceSecondsTotal + (p.addVoiceMin ?? 0) * 60,
      },
      closePrevious: false,
    };
  }
  const mult = p.perSeat ? Math.max(seats, p.minSeats ?? 1) : 1;
  const reports = p.reports * mult;
  const voice = p.voiceMin * 60 * mult;
  // Same product while active: extend and add allowances.
  if (isActive(active, now) && active.productCode === code) {
    return {
      pass: {
        ...active,
        endsAt: new Date(active.endsAt.getTime() + p.days * DAY),
        reportsTotal: active.reportsTotal + reports,
        voiceSecondsTotal: active.voiceSecondsTotal + voice,
      },
      closePrevious: false,
    };
  }
  // New or different product: start now; carry over any unused balance from an active pass.
  const carryReports = isActive(active, now) ? reportsLeft(active) : 0;
  const carryVoice = isActive(active, now) ? voiceSecondsLeft(active) : 0;
  return {
    pass: {
      productCode: code,
      startsAt: now,
      endsAt: new Date(now.getTime() + p.days * DAY),
      reportsTotal: reports + carryReports,
      reportsUsed: 0,
      voiceSecondsTotal: voice + carryVoice,
      voiceSecondsUsed: 0,
      features: [...p.features],
    },
    closePrevious: isActive(active, now),
  };
}

export function trialPass(now = new Date()): PassState {
  const t = PRODUCTS.trial;
  return {
    productCode: 'trial',
    startsAt: now,
    endsAt: new Date(now.getTime() + t.days * DAY),
    reportsTotal: t.reports,
    reportsUsed: 0,
    voiceSecondsTotal: t.voiceMin * 60,
    voiceSecondsUsed: 0,
    features: [...t.features],
  };
}

/** New processing needs an active pass with a report left. Reading/exporting Finals never does. */
export function assertCanProcess(p: PassState | null, opts: { voiceSeconds?: number } = {}, now = new Date()) {
  if (!isActive(p, now)) throw new EntitlementError('NO_PASS', 'You need an active pass or trial to process new notes. Your saved records stay available.');
  if (reportsLeft(p) <= 0) throw new EntitlementError('NO_REPORTS', 'You have used all reports on this pass. Add a top-up or buy a new pass.');
  if (opts.voiceSeconds && voiceSecondsLeft(p) <= 0) throw new EntitlementError('NO_VOICE', 'You have used all voice minutes on this pass. Add a voice top-up.');
}

export function hasFeature(p: PassState | null, f: Feature, now = new Date()): boolean {
  return isActive(p, now) && p.features.includes(f);
}

export type Warning = 'reports_80' | 'voice_80' | 'expires_2_days' | 'last_day';

export function warnings(p: PassState | null, now = new Date()): Warning[] {
  if (!isActive(p, now)) return [];
  const w: Warning[] = [];
  if (p.reportsTotal && p.reportsUsed / p.reportsTotal >= 0.8) w.push('reports_80');
  if (p.voiceSecondsTotal && p.voiceSecondsUsed / p.voiceSecondsTotal >= 0.8) w.push('voice_80');
  const left = p.endsAt.getTime() - now.getTime();
  if (left <= DAY) w.push('last_day');
  else if (left <= 2 * DAY) w.push('expires_2_days');
  return w;
}

/** Uganda mobile number → +2567XXXXXXXX, or null if invalid. */
export function normaliseUgPhone(input: string): string | null {
  const d = input.replace(/[\s()-]/g, '');
  const m = d.match(/^(?:\+?256|0)?(7\d{8})$/);
  return m ? `+256${m[1]}` : null;
}

export function maskPhone(e164: string): string {
  return `${e164.slice(0, 6)}•••${e164.slice(-3)}`;
}

/** MTN or Airtel prefix check (Uganda). */
export function mobileNetwork(e164: string): 'MTN' | 'Airtel' | null {
  const p = e164.slice(4, 6);
  if (['76', '77', '78', '79'].includes(p)) return 'MTN';
  if (['70', '74', '75'].includes(p)) return 'Airtel';
  return null;
}
