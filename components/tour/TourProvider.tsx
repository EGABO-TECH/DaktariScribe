'use client';

/**
 * Guided tour for new users (and on request). Opens once per account: finishing or skipping is
 * stored in Clerk's unsafeMetadata (so it follows the user across devices), with a localStorage
 * copy so it never flashes again on this device while that save is in flight.
 */
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { TOUR_STEPS, type TourStep } from './tour-steps';

type TourContextValue = { start: () => void; active: boolean };
const TourContext = createContext<TourContextValue>({ start: () => {}, active: false });

export function useTour() {
  return useContext(TourContext);
}

const doneKey = (userId: string) => `ds-tour-done:${userId}`;

function readLocalDone(userId: string): boolean {
  try {
    return localStorage.getItem(doneKey(userId)) === '1';
  } catch {
    return false;
  }
}

/** The visible element for a data-tour target (the sidebar and the phone bar share names). */
function findTarget(name: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function waitForTarget(name: string, timeoutMs = 2500): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const el = findTarget(name);
      if (el) return resolve(el);
      if (performance.now() - t0 > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export default function TourProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [index, setIndex] = useState<number | null>(null);
  const autoChecked = useRef(false);

  const start = useCallback(() => setIndex(0), []);
  const navigate = useCallback((href: string) => router.push(href), [router]);

  const finish = useCallback(() => {
    setIndex(null);
    if (!user) return;
    try {
      localStorage.setItem(doneKey(user.id), '1');
    } catch {
      /* storage unavailable */
    }
    void user.update({ unsafeMetadata: { ...user.unsafeMetadata, tourCompletedAt: new Date().toISOString() } }).catch(() => {
      /* the local copy still stops it reopening on this device */
    });
  }, [user]);

  // First visit: open automatically once Clerk has loaded the account.
  useEffect(() => {
    if (!isLoaded || !user || autoChecked.current) return;
    autoChecked.current = true;
    if (user.unsafeMetadata?.tourCompletedAt || readLocalDone(user.id)) return;
    const t = window.setTimeout(() => setIndex(0), 600);
    return () => window.clearTimeout(t);
  }, [isLoaded, user]);

  return (
    <TourContext.Provider value={{ start, active: index !== null }}>
      {children}
      {index !== null && (
        <TourOverlay
          index={index}
          setIndex={setIndex}
          onFinish={finish}
          pathname={pathname}
          navigate={navigate}
        />
      )}
    </TourContext.Provider>
  );
}

type Rect = { top: number; left: number; width: number; height: number };

function TourOverlay({
  index,
  setIndex,
  onFinish,
  pathname,
  navigate,
}: {
  index: number;
  setIndex: (i: number | null) => void;
  onFinish: () => void;
  pathname: string;
  navigate: (href: string) => void;
}) {
  const direction = useRef<1 | -1>(1);
  const total = TOUR_STEPS.length;

  const go = useCallback(
    (next: number) => {
      direction.current = next >= index ? 1 : -1;
      if (next < 0) return;
      if (next >= total) return onFinish();
      setIndex(next);
    },
    [index, total, onFinish, setIndex],
  );
  const skipUnavailable = useCallback(() => go(index + direction.current), [go, index]);

  // Keyboard: Esc closes, arrows move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
      else if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'ArrowLeft' && index > 0) go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, onFinish]);

  // Keyed by step, so each step starts with fresh state.
  return (
    <TourStepView
      key={index}
      step={TOUR_STEPS[index]}
      index={index}
      total={total}
      pathname={pathname}
      navigate={navigate}
      onBack={() => go(index - 1)}
      onNext={() => go(index + 1)}
      onSkip={onFinish}
      onUnavailable={skipUnavailable}
    />
  );
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function TourStepView({
  step,
  index,
  total,
  pathname,
  navigate,
  onBack,
  onNext,
  onSkip,
  onUnavailable,
}: {
  step: TourStep;
  index: number;
  total: number;
  pathname: string;
  navigate: (href: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onUnavailable: () => void;
}) {
  /** null until the target has been looked for; rect null = not found, show the window centred. */
  const [found, setFound] = useState<{ rect: Rect | null } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const pathOk = !step.href || pathname === step.href;
  const ready = pathOk && (!step.target || found !== null);
  const isLast = index === total - 1;

  // Move to the step's page, find its target, then measure it.
  useEffect(() => {
    if (!pathOk) {
      navigate(step.href!);
      return; // runs again once the new page is showing
    }
    if (!step.target) return;
    let cancelled = false;
    void waitForTarget(step.target).then((el) => {
      if (cancelled) return;
      if (!el) {
        // Not on screen for this user or screen size: skip optional steps, centre the rest.
        if (step.optional) onUnavailable();
        else setFound({ rect: null });
        return;
      }
      targetRef.current = el;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.setTimeout(() => {
        if (!cancelled) setFound({ rect: measure(el) });
      }, 250);
    });
    return () => {
      cancelled = true;
    };
  }, [pathOk, step, navigate, onUnavailable]);

  // Keep the highlight on the target while scrolling or resizing.
  useEffect(() => {
    const update = () => {
      if (targetRef.current) setFound({ rect: measure(targetRef.current) });
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);

  useEffect(() => {
    if (ready) dialogRef.current?.focus();
  }, [ready]);

  const rect = found?.rect ?? null;
  const pad = 8;
  const spot = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;

  return (
    <div className="fixed inset-0 z-[100]" aria-hidden={false}>
      {/* Dim layer; the spotlight is a hole made by the highlight's huge shadow. */}
      {spot ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-secondary-fixed-dim transition-all duration-200 motion-reduce:transition-none"
          style={{ ...spot, boxShadow: '0 0 0 9999px rgba(0, 15, 31, 0.6)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(0,15,31,0.6)]" />
      )}
      {/* Clicks outside the window do nothing, so the tour isn't lost by accident. */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      {ready && (
        <TourCard
          ref={dialogRef}
          step={step}
          index={index}
          total={total}
          isLast={isLast}
          spot={spot}
          onBack={onBack}
          onNext={onNext}
          onSkip={onSkip}
        />
      )}
    </div>
  );
}

const TourCard = React.forwardRef<
  HTMLDivElement,
  {
    step: TourStep;
    index: number;
    total: number;
    isLast: boolean;
    spot: Rect | null;
    onBack: () => void;
    onNext: () => void;
    onSkip: () => void;
  }
>(function TourCard({ step, index, total, isLast, spot, onBack, onNext, onSkip }, ref) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<React.CSSProperties>({ visibility: 'hidden' });

  // Place the card beside the highlight (right, below or above), kept inside the viewport.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const m = 16;
    if (!spot || vw < 640) {
      // Centred window, or a sheet above the phone's bottom bar.
      setPos(vw < 640 ? { left: m, right: m, bottom: spot && spot.top > vh / 2 ? vh - spot.top + m : 80 } : { left: (vw - cw) / 2, top: Math.max(m, (vh - ch) / 2) });
      return;
    }
    const clampTop = (t: number) => Math.min(Math.max(m, t), vh - ch - m);
    const clampLeft = (l: number) => Math.min(Math.max(m, l), vw - cw - m);
    if (spot.left + spot.width + m + cw <= vw - m && spot.width < vw / 2) {
      setPos({ left: spot.left + spot.width + m, top: clampTop(spot.top) });
    } else if (spot.top + spot.height + m + ch <= vh - m) {
      setPos({ left: clampLeft(spot.left), top: spot.top + spot.height + m });
    } else {
      setPos({ left: clampLeft(spot.left), top: clampTop(spot.top - ch - m) });
    }
  }, [spot, step.id]);

  return (
    <div
      ref={(el) => {
        cardRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      tabIndex={-1}
      style={pos}
      className="fixed w-auto max-w-[400px] rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface shadow-2xl outline-none sm:w-[400px]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary" aria-hidden="true">
          <span className="material-symbols-outlined text-[24px]">{step.icon}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Step {index + 1} of {total}
          </p>
          <h2 id="tour-title" className="mt-0.5 font-headline-sm text-[19px] font-bold leading-snug text-primary">
            {step.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Close tour"
          className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>

      <p id="tour-body" className="mt-3 text-[15px] leading-relaxed text-on-surface-variant">
        {step.body}
      </p>

      {/* Progress */}
      <div className="mt-4 flex gap-1" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-secondary' : 'bg-surface-container-high'}`} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        {index === 0 ? (
          <button type="button" onClick={onSkip} className="min-h-11 rounded-lg px-3 text-[14px] font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
            I know my way around, skip
          </button>
        ) : (
          <button type="button" onClick={onSkip} className="min-h-11 rounded-lg px-3 text-[14px] font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
            Skip tour
          </button>
        )}
        <div className="flex gap-2">
          {index > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-outline-variant px-4 text-[14px] font-semibold text-on-surface hover:bg-surface-container-low"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-primary px-5 text-[14px] font-semibold text-on-primary hover:bg-primary/90"
          >
            {index === 0 ? 'Start the tour' : isLast ? 'Finish' : 'Next'}
            {!isLast && (
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                arrow_forward
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
