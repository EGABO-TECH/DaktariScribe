'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS, isActive, visibleLinks } from './nav-links';
import { useWorkspaceAccess } from './use-workspace-access';

export default function BottomNav() {
  const pathname = usePathname();
  const links = visibleLinks(NAV_LINKS, useWorkspaceAccess());
  return (
    <nav aria-label="Main" className="fixed bottom-0 z-50 flex h-16 w-full items-stretch justify-around border-t border-outline-variant bg-surface-container-lowest lg:hidden">
      {links.map(({ href, icon, short, match }) => {
        const active = isActive(pathname, match);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-w-16 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold transition-colors ${
              active ? 'text-secondary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className={`material-symbols-outlined text-[24px] ${active ? 'icon-fill' : ''}`} aria-hidden="true">
              {icon}
            </span>
            {short}
          </Link>
        );
      })}
    </nav>
  );
}
