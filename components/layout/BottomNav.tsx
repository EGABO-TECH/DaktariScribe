import React from 'react';
import Link from 'next/link';

export default function BottomNav() {
    return (
        <nav className="lg:hidden flex justify-around items-center h-16 w-full fixed bottom-0 z-50 bg-surface-container border-t border-outline-variant shadow-lg rounded-t-xl">
            <Link className="flex flex-col items-center text-on-surface-variant p-2 w-16 active:bg-surface-variant rounded-lg transition-colors" href="/field-entry">
                <span className="material-symbols-outlined text-[24px]">mic</span>
                <span className="font-body-sm text-[10px] mt-1">Entry</span>
            </Link>
            <Link className="flex flex-col items-center text-on-surface-variant p-2 w-16 active:bg-surface-variant rounded-lg transition-colors" href="/saved-records">
                <span className="material-symbols-outlined text-[24px]">library_books</span>
                <span className="font-body-sm text-[10px] mt-1">Library</span>
            </Link>
            <Link className="flex flex-col items-center text-secondary font-bold scale-110 p-2 w-16 rounded-lg transition-transform" href="/reports">
                <span className="material-symbols-outlined text-[24px]">analytics</span>
                <span className="font-body-sm text-[10px] mt-1">Reports</span>
            </Link>
            <Link className="flex flex-col items-center text-on-surface-variant p-2 w-16 active:bg-surface-variant rounded-lg transition-colors" href="#">
                <span className="material-symbols-outlined text-[24px]">ios_share</span>
                <span className="font-body-sm text-[10px] mt-1">Exports</span>
            </Link>
            <Link className="flex flex-col items-center text-on-surface-variant p-2 w-16 active:bg-surface-variant rounded-lg transition-colors" href="#">
                <span className="material-symbols-outlined text-[24px]">sync</span>
                <span className="font-body-sm text-[10px] mt-1">Sync</span>
            </Link>
        </nav>
    );
}
