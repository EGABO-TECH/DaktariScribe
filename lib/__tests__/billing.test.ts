import { describe, it, expect } from 'vitest';
import { applyPurchase, assertCanProcess, EntitlementError, isActive, maskPhone, normaliseUgPhone, trialPass, warnings, type PassState } from '@/lib/billing/rules';
import { PRODUCTS, priceFor, NYLONPAY_MIN_UGX, PURCHASABLE } from '@/lib/billing/plans';

const DAY = 24 * 3600 * 1000;
const t0 = new Date('2026-08-01T08:00:00Z');

describe('plans', () => {
  it('keeps every price in whole UGX at or above the Nylon Pay minimum', () => {
    for (const c of PURCHASABLE) {
      expect(Number.isInteger(priceFor(c))).toBe(true);
      expect(priceFor(c)).toBeGreaterThanOrEqual(NYLONPAY_MIN_UGX);
    }
    expect(PRODUCTS.pro_quarter.features).toEqual(PRODUCTS.monthly_pro.features);
    expect(priceFor('team_seat', 3)).toBe(25_000 * 5); // minimum 5 seats
  });
});

describe('entitlement rules', () => {
  const weekly = applyPurchase(null, 'weekly', t0).pass;

  it('buying the same product while active extends and adds allowances', () => {
    const used = { ...weekly, reportsUsed: 5 };
    const r = applyPurchase(used, 'weekly', new Date(t0.getTime() + DAY));
    expect(r.closePrevious).toBe(false);
    expect(r.pass.endsAt.getTime()).toBe(weekly.endsAt.getTime() + 7 * DAY);
    expect(r.pass.reportsTotal).toBe(30);
    expect(r.pass.reportsUsed).toBe(5);
  });

  it('upgrading starts now and carries over unused balance', () => {
    const used: PassState = { ...weekly, reportsUsed: 6, voiceSecondsUsed: 600 };
    const now = new Date(t0.getTime() + 2 * DAY);
    const r = applyPurchase(used, 'monthly_pro', now);
    expect(r.closePrevious).toBe(true);
    expect(r.pass.startsAt).toEqual(now);
    expect(r.pass.reportsTotal).toBe(150 + 9);
    expect(r.pass.voiceSecondsTotal).toBe(180 * 60 + (20 * 60 - 600));
    expect(r.pass.features).toContain('pptx');
  });

  it('top-ups need an active pass and end with it', () => {
    expect(() => applyPurchase(null, 'topup_reports', t0)).toThrow(EntitlementError);
    const r = applyPurchase(weekly, 'topup_reports', t0);
    expect(r.pass.reportsTotal).toBe(25);
    expect(r.pass.endsAt).toEqual(weekly.endsAt);
    const expired = new Date(weekly.endsAt.getTime() + 1);
    expect(() => applyPurchase(weekly, 'topup_voice', expired)).toThrow(EntitlementError);
  });

  it('an expired pass blocks new processing (but exporting Finals never checks a pass)', () => {
    const after = new Date(weekly.endsAt.getTime() + 1);
    expect(isActive(weekly, after)).toBe(false);
    expect(() => assertCanProcess(weekly, {}, after)).toThrow(/active pass/);
  });

  it('blocks processing when reports or voice are used up', () => {
    expect(() => assertCanProcess({ ...weekly, reportsUsed: 15 }, {}, t0)).toThrow(/reports/);
    expect(() => assertCanProcess({ ...weekly, voiceSecondsUsed: 20 * 60 }, { voiceSeconds: 1 }, t0)).toThrow(/voice/);
    expect(() => assertCanProcess(weekly, { voiceSeconds: 1 }, t0)).not.toThrow();
  });

  it('trial is 7 days with 10 reports and 20 voice minutes', () => {
    const t = trialPass(t0);
    expect(t.endsAt.getTime() - t0.getTime()).toBe(7 * DAY);
    expect(t.reportsTotal).toBe(10);
    expect(t.voiceSecondsTotal).toBe(1200);
  });

  it('warns at 80% use, 2 days before expiry and on the last day', () => {
    expect(warnings({ ...weekly, reportsUsed: 12 }, t0)).toContain('reports_80');
    expect(warnings(weekly, new Date(weekly.endsAt.getTime() - 1.5 * DAY))).toContain('expires_2_days');
    expect(warnings(weekly, new Date(weekly.endsAt.getTime() - 3600_000))).toContain('last_day');
  });
});

describe('phone numbers', () => {
  it('normalises Ugandan numbers and masks them', () => {
    expect(normaliseUgPhone('0772 123 456')).toBe('+256772123456');
    expect(normaliseUgPhone('+256-701-234567')).toBe('+256701234567');
    expect(normaliseUgPhone('256772123456')).toBe('+256772123456');
    expect(normaliseUgPhone('12345')).toBeNull();
    expect(maskPhone('+256772123456')).toBe('+25677•••456');
  });
});
