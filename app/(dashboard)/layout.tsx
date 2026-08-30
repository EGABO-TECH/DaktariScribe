import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="bg-background text-on-background font-body-md min-h-screen flex overflow-hidden">
            <Sidebar />
            <div className="flex-1 lg:ml-[280px] flex flex-col h-screen overflow-hidden bg-background relative z-10 w-full">
                <Header />
                {children}
            </div>
            <BottomNav />
        </div>
    );
}
