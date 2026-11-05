'use client';

import React, { useSyncExternalStore } from 'react';
import { UserButton, useUser } from '@clerk/nextjs';
import SyncStatus from '@/components/offline/SyncStatus';
import PassChip from '@/components/billing/PassChip';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'dark' || set === 'light') return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener('change', cb);
  };
}

function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(subscribeTheme, currentTheme, () => null);
  const toggle = () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('ds-theme', next);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="flex h-12 w-12 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
}

export default function Header() {
  const { user, isLoaded } = useUser();
  const name = isLoaded && user ? user.firstName || user.username || '' : '';

  return (
    <header className="z-30 flex h-16 w-full shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-margin-mobile md:h-20 md:px-margin-desktop">
      <p className="truncate font-headline-md text-[20px] font-semibold text-primary md:text-[24px]">
        {name ? (
          <>
            Welcome, <span className="text-secondary">{name}</span>
          </>
        ) : (
          'DaktariScribe'
        )}
      </p>
      <div className="flex items-center gap-2">
        <SyncStatus />
        <PassChip />
        <ThemeToggle />
        <UserButton />
      </div>
    </header>
  );
}
