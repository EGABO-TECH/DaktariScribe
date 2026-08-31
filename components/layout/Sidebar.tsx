'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useClerk, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';

const NAV_LINKS = [
    { href: '/field-entry', icon: 'mic', label: 'Field Entry' },
    { href: '/saved-records', icon: 'library_books', label: 'Saved Records' },
    { href: '/reports', icon: 'ios_share', label: 'Reports Generator' },
];

export default function Sidebar() {
    const { signOut } = useClerk();
    const { user, isLoaded } = useUser();
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut();
        router.push('/');
    };

    return (
        <nav className="hidden lg:flex flex-col h-screen fixed left-0 w-[280px] bg-primary text-on-primary py-stack-lg z-40 transition-all duration-200 ease-in-out border-r border-outline-variant shadow-[4px_0_24px_rgba(0,0,0,0.2)] shrink-0">
            {/* Profile Header */}
            <div className="px-6 pb-6 border-b border-on-primary/10">
                <div className="flex flex-col items-center gap-2">
                    <div className="flex-shrink-0 bg-white rounded-lg p-1 w-16 h-16 overflow-hidden flex items-center justify-center">
                        {isLoaded && user?.imageUrl ? (
                            <img
                                src={user.imageUrl}
                                alt={user.fullName || 'User'}
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
                        <span className="font-bold leading-tight tracking-tight text-on-primary font-display-lg text-[32px]">DaktariScribe</span>
                        <span className="font-label-status text-secondary-fixed-dim uppercase tracking-wider font-bold text-[12px]">Clinical Pharma Network</span>
                    </div>
                </div>
            </div>
            
            {/* Navigation Links */}
            <ul className="flex-1 overflow-y-auto pt-4 px-2 space-y-1">
                {NAV_LINKS.map(({ href, icon, label }) => {
                    const isActive = pathname === href;
                    return (
                        <li key={href} className="relative group">
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-secondary-fixed rounded-r-full" />
                            )}
                            <Link
                                className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 ${
                                    isActive
                                        ? 'bg-secondary/20 text-on-primary'
                                        : 'text-on-primary/70 hover:text-on-primary hover:bg-white/5'
                                }`}
                                href={href}
                            >
                                <span className={`material-symbols-outlined ${isActive ? 'icon-fill text-secondary-fixed' : ''}`}>{icon}</span>
                                <span className={`font-body-lg ${isActive ? 'font-semibold' : ''}`}>{label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
            
            <div className="mt-auto pt-4 px-2 border-t border-on-primary/10">
                <div className="px-2 pb-6">
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-4 px-6 py-4 text-on-primary/60 hover:text-error hover:bg-error/10 rounded-xl transition-all duration-200 group"
                    >
                        <span className="material-symbols-outlined group-hover:text-error">logout</span>
                        <span className="font-body-lg font-medium">Logout</span>
                    </button>
                </div>
            </div>
        </nav>
    );
}
