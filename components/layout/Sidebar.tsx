'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useClerk, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { ADMIN_LINKS, NAV_LINKS, isActive as matchActive, visibleLinks } from './nav-links';
import { useWorkspaceAccess } from './use-workspace-access';
import { wipeDevice } from '@/lib/offline/db';
import { lock } from '@/lib/offline/crypto';
import { pendingCount } from '@/lib/offline/outbox';

type NavItem = (typeof NAV_LINKS)[number];

const focusRing =
    'outline-none focus-visible:ring-2 focus-visible:ring-secondary-fixed-dim focus-visible:ring-offset-2 focus-visible:ring-offset-nav';

function NavSection({ title, links, pathname }: { title: string; links: NavItem[]; pathname: string }) {
    if (links.length === 0) return null;
    const headingId = `nav-${title.toLowerCase().replace(/\s+/g, '-')}`;
    return (
        <div>
            <p id={headingId} className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-on-nav/50">
                {title}
            </p>
            <ul aria-labelledby={headingId} className="space-y-0.5">
                {links.map(({ href, icon, label, match }) => {
                    const active = matchActive(pathname, match);
                    return (
                        <li key={href}>
                            <Link
                                href={href}
                                aria-current={active ? 'page' : undefined}
                                className={`group relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors duration-150 ${focusRing} ${
                                    active
                                        ? 'bg-white/[0.08] font-semibold text-on-nav'
                                        : 'font-medium text-on-nav/70 hover:bg-white/[0.04] hover:text-on-nav'
                                }`}
                            >
                                {active && (
                                    <span aria-hidden="true" className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-secondary-fixed-dim" />
                                )}
                                <span
                                    aria-hidden="true"
                                    className={`material-symbols-outlined text-[22px] transition-colors ${
                                        active ? 'icon-fill text-secondary-fixed-dim' : 'text-on-nav/60 group-hover:text-on-nav/90'
                                    }`}
                                >
                                    {icon}
                                </span>
                                <span className="truncate">{label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function Sidebar() {
    const { signOut } = useClerk();
    const { user, isLoaded } = useUser();
    const pathname = usePathname();
    const router = useRouter();
    const access = useWorkspaceAccess();
    const mainLinks = visibleLinks(NAV_LINKS, access);
    const adminLinks = visibleLinks(ADMIN_LINKS, access);

    const name = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || '';
    const email = user?.primaryEmailAddress?.emailAddress ?? '';

    const handleSignOut = async () => {
        // Logging out wipes everything stored on this device (spec Phase 4.3).
        try {
            const waiting = await pendingCount().catch(() => 0);
            if (waiting > 0 && !window.confirm(`${waiting} encounter(s) have not uploaded yet. Signing out deletes them from this device. Sign out anyway?`)) return;
            lock();
            await wipeDevice();
        } catch {
            /* IndexedDB unavailable */
        }
        await signOut();
        router.push('/');
    };

    return (
        <nav
            aria-label="Main"
            className="fixed left-0 z-40 hidden h-screen w-[280px] shrink-0 flex-col border-r border-white/10 bg-nav text-on-nav lg:flex"
        >
            {/* Brand */}
            <div className="flex h-20 shrink-0 items-center gap-3 border-b border-white/10 px-5">
                <Link href="/field-entry" className={`flex min-w-0 items-center gap-3 rounded-lg ${focusRing}`}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
                        <Image src="/assets/DaktariScribe-Favicon.png" alt="" width={40} height={40} priority className="object-contain" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate font-display-lg text-[19px] font-bold leading-tight tracking-tight text-on-nav">DaktariScribe</span>
                        <span className="truncate text-[12px] font-medium text-secondary-fixed-dim">Field Clinical Records</span>
                    </span>
                </Link>
            </div>

            {/* Navigation */}
            <div className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
                <NavSection title="Workspace" links={mainLinks} pathname={pathname} />
                <NavSection title="Administration" links={adminLinks} pathname={pathname} />
            </div>

            {/* Account */}
            <div className="shrink-0 border-t border-white/10 p-3">
                <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-[14px] font-semibold text-on-nav ring-1 ring-white/15">
                        {isLoaded && user?.imageUrl ? (
                            <Image src={user.imageUrl} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" />
                        ) : (
                            <span aria-hidden="true">{isLoaded ? initials(name) : ''}</span>
                        )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                        {isLoaded ? (
                            <>
                                <span className="truncate text-[14px] font-semibold text-on-nav">{name || 'Signed in'}</span>
                                {email && email !== name && <span className="truncate text-[12px] text-on-nav/60">{email}</span>}
                            </>
                        ) : (
                            <>
                                <span className="mb-1.5 h-3 w-28 rounded bg-white/10" />
                                <span className="h-2.5 w-36 rounded bg-white/[0.06]" />
                            </>
                        )}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={handleSignOut}
                    className={`mt-1 flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-on-nav/70 transition-colors duration-150 hover:bg-white/[0.04] hover:text-on-nav ${focusRing}`}
                >
                    <span aria-hidden="true" className="material-symbols-outlined text-[22px] text-on-nav/60">
                        logout
                    </span>
                    Sign out
                </button>
            </div>
        </nav>
    );
}
