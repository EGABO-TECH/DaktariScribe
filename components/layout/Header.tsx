'use client';

import React, { useSyncExternalStore } from 'react';
import { UserButton, useAuth, useUser } from '@clerk/nextjs';
import SyncStatus from '@/components/offline/SyncStatus';
import PassChip from '@/components/billing/PassChip';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import { ADMIN_LINKS, visibleLinks } from './nav-links';
import { useWorkspaceAccess } from './use-workspace-access';
import { useTour } from '@/components/tour/TourProvider';

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

function HelpButton() {
  const { start } = useTour();
  return (
    <button
      type="button"
      onClick={start}
      data-tour="tour-help"
      aria-label="Take the guided tour"
      title="Take the guided tour"
      className="flex h-12 w-12 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        help
      </span>
    </button>
  );
}

export default function Header() {
  const { user, isLoaded } = useUser();
  const name = isLoaded && user ? user.firstName || user.username || '' : '';
  const { orgId } = useAuth();
  const adminLinks = visibleLinks(ADMIN_LINKS, useWorkspaceAccess());

  return (
    <header className="z-30 flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-lowest px-margin-mobile md:h-20 md:px-margin-desktop">
      <p className="hidden min-w-0 truncate font-headline-md text-[20px] font-semibold text-primary sm:block md:text-[24px]">
        {name ? (
          <>
            Welcome, <span className="text-secondary">{name}</span>
          </>
        ) : (
          'DaktariScribe'
        )}
      </p>
      <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
        <SyncStatus />
        {/* Passes can differ per workspace, so reload the chip after a switch. */}
        <PassChip key={orgId ?? 'personal'} />
        <div data-tour="workspace-switcher" className="min-w-0">
          <WorkspaceSwitcher />
        </div>
        <HelpButton />
        <ThemeToggle />
        {adminLinks.length ? (
          <UserButton>
            <UserButton.MenuItems>
              {adminLinks.map(({ href, icon, label }) => (
                <UserButton.Link
                  key={href}
                  href={href}
                  label={label}
                  labelIcon={
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      {icon}
                    </span>
                  }
                />
              ))}
            </UserButton.MenuItems>
          </UserButton>
        ) : (
          <UserButton />
        )}
      </div>
    </header>
  );
}
