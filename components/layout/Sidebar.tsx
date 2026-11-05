'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useClerk, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_LINKS, isActive as matchActive } from './nav-links';
import { wipeDevice } from '@/lib/offline/db';
import { lock } from '@/lib/offline/crypto';
import { pendingCount } from '@/lib/offline/outbox';


export default function Sidebar() {
    const { signOut } = useClerk();
    const { user, isLoaded } = useUser();
    const pathname = usePathname();
    const router = useRouter();

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
        <nav aria-label="Main" className="hidden lg:flex flex-col h-screen fixed left-0 w-[280px] bg-nav text-on-nav py-stack-lg z-40 transition-all duration-200 ease-in-out border-r border-outline-variant shadow-[4px_0_24px_rgba(0,0,0,0.2)] shrink-0">
            {/* Profile Header */}
            <div className="px-6 pb-6 border-b border-on-nav/10">
                <div className="flex flex-col items-center gap-2">
                    <div className="flex-shrink-0 bg-white rounded-lg p-1 w-16 h-16 overflow-hidden flex items-center justify-center">
                        {isLoaded && user?.imageUrl ? (
                            <Image
                                src={user.imageUrl}
                                alt={user.fullName || 'User'}
                                width={64}
                                height={64}
                                unoptimized
                                className="w-full h-full object-cover rounded-md"
                            />
                        ) : (
                            <Image
                                src="/assets/DaktariScribe-Favicon.png"
                                alt="DaktariScribe Logo"
                                width={52}
                                height={52}
                                className="object-contain"
                            />
                        )}
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <span className="font-bold leading-tight tracking-tight text-on-nav font-display-lg text-[32px]">DaktariScribe</span>
                        <span className="font-label-status text-secondary-fixed-dim uppercase tracking-wider font-bold text-[12px]">Field Clinical Records</span>
                    </div>
                </div>
            </div>
            
            {/* Navigation Links */}
            <ul className="flex-1 overflow-y-auto pt-4 px-2 space-y-1">
                {NAV_LINKS.map(({ href, icon, label, match }) => {
                    const isActive = matchActive(pathname, match);
                    return (
                        <li key={href} className="relative group">
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-secondary-fixed rounded-r-full" />
                            )}
                            <Link
                                className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 ${
                                    isActive
                                        ? 'bg-secondary/20 text-on-nav'
                                        : 'text-on-nav/70 hover:text-on-nav hover:bg-white/5'
                                }`}
                                href={href}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <span aria-hidden="true" className={`material-symbols-outlined ${isActive ? 'icon-fill text-secondary-fixed' : ''}`}>{icon}</span>
                                <span className={`font-body-lg ${isActive ? 'font-semibold' : ''}`}>{label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
            
            <div className="mt-auto pt-4 px-2 border-t border-on-nav/10">
                <div className="px-2 pb-6">
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-4 px-6 py-4 text-on-nav/80 hover:text-on-nav hover:bg-white/10 rounded-xl transition-all duration-200 group"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined">logout</span>
                        <span className="font-body-lg font-medium">Sign out</span>
                    </button>
                </div>
            </div>
        </nav>
    );
}
