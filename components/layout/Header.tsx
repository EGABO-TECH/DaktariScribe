import React from 'react';
import { UserButton } from '@clerk/nextjs';

export default function Header() {
    return (
        <header className="flex justify-between items-center w-full bg-surface-container-lowest border-b border-outline-variant/30 z-30 shrink-0 h-24 px-12 py-6">
            <div className="flex items-center gap-4">
                <h1 className="font-headline-md text-primary text-[32px] font-display-lg">
                    Welcome, <span className="text-secondary">Dr. Egabo Aaron</span>
                </h1>
            </div>
            <div className="flex items-center gap-4">
                {/* Theme Toggle */}
                <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant">
                    <span className="material-symbols-outlined">dark_mode</span>
                </button>
                
                {/* Profile Pill */}
                <UserButton />
            </div>
        </header>
    );
}
