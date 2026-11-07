import { describe, expect, it } from 'vitest';
import { TOUR_STEPS } from '@/components/tour/tour-steps';
import { NAV_LINKS } from '@/components/layout/nav-links';

describe('tour steps', () => {
  it('have unique ids and open with a centred welcome', () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    expect(TOUR_STEPS[0].target).toBeUndefined();
  });

  it('point nav steps at real navigation links', () => {
    const navTargets = new Set(NAV_LINKS.map((l) => `nav-${l.href.slice(1)}`));
    for (const s of TOUR_STEPS.filter((x) => x.target?.startsWith('nav-'))) {
      expect(navTargets.has(s.target!)).toBe(true);
      expect(NAV_LINKS.some((l) => l.href === s.href)).toBe(true);
    }
  });
});
