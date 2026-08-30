import React from 'react';
import Link from 'next/link';

export default function Sidebar() {
    return (
        <nav className="hidden lg:flex flex-col h-screen fixed left-0 w-[280px] bg-primary text-on-primary py-stack-lg z-40 transition-all duration-200 ease-in-out border-r border-outline-variant shadow-[4px_0_24px_rgba(0,0,0,0.2)] shrink-0">
            {/* Profile Header */}
            <div className="px-6 pb-6 border-b border-on-primary/10">
                <div className="flex flex-col items-center gap-2">
                    <div className="flex-shrink-0 bg-white rounded-lg p-1 w-16 h-16">
                        <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUUBo1v_qRPpS9CgQnpeaMeHsG9O9FkjxE8cigj6J43hmymU1ZYqYuwz-eOkNm88oflBO944YmIfcchmtPWrN1GBuftCOWGw_VFn0wInNmb5YCnIDTH0Q9jf8SeCC9ijSaaVyKRYh0WtPIjU7sVViqpvTwvPaXEffb4n5BXNn11CEzHkbsQtwXl3q_3cy48VhTYgZ3RP7IO5N4eXLOSyGTnQ2djaqiFwpG02zCNjFyBBEhbwW3op4q7GcdNDaAjSJeMC4"
                            alt="DaktariScribe Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col items-center text-center">
                        <span className="font-bold leading-tight tracking-tight text-on-primary font-display-lg text-[32px]">DaktariScribe</span>
                        <span className="font-label-status text-secondary-fixed-dim uppercase tracking-wider font-bold text-[12px]">Clinical Pharma Network</span>
                    </div>
                </div>
            </div>
            
            {/* Navigation Links */}
            <ul className="flex-1 overflow-y-auto pt-4 px-2 space-y-1">
                <li className="relative group">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-secondary-fixed rounded-r-full"></div>
                    <Link className="flex items-center gap-4 px-6 py-4 bg-secondary/20 text-on-primary rounded-xl transition-all duration-200" href="/field-entry">
                        <span className="material-symbols-outlined icon-fill text-secondary-fixed">mic</span>
                        <span className="font-body-lg font-semibold">Field Entry</span>
                    </Link>
                </li>
                <li className="px-2">
                    <Link className="flex items-center gap-4 px-4 py-4 text-on-primary/70 hover:text-on-primary hover:bg-white/5 rounded-xl transition-all duration-200" href="/saved-records">
                        <span className="material-symbols-outlined">library_books</span>
                        <span className="font-body-lg">Saved Records</span>
                    </Link>
                </li>
                <li className="px-2">
                    <Link className="flex items-center gap-4 px-4 py-4 text-on-primary/70 hover:text-on-primary hover:bg-white/5 rounded-xl transition-all duration-200" href="/reports">
                        <span className="material-symbols-outlined">ios_share</span>
                        <span className="font-body-lg">Reports Generator</span>
                    </Link>
                </li>
            </ul>
            
            <div className="mt-auto pt-4 px-2 border-t border-on-primary/10">
                <div className="px-2 pb-6">
                    <Link className="flex items-center gap-4 px-6 py-4 text-on-primary/60 hover:text-error hover:bg-error/10 rounded-xl transition-all duration-200 group" href="#">
                        <span className="material-symbols-outlined group-hover:text-error">logout</span>
                        <span className="font-body-lg font-medium">Logout</span>
                    </Link>
                </div>
            </div>
        </nav>
    );
}
