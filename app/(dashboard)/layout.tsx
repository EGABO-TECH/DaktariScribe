import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import OfflineBanner from '@/components/layout/OfflineBanner';
import DeviceProvider from '@/components/offline/DeviceProvider';
import TourProvider from '@/components/tour/TourProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DeviceProvider>
    <TourProvider>
    <div className="flex min-h-screen overflow-hidden bg-background font-body-md text-on-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-on-primary"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="relative z-10 flex h-screen w-full flex-1 flex-col overflow-hidden bg-background lg:ml-[280px]">
        <Header />
        <OfflineBanner />
        {children}
      </div>
      <BottomNav />
    </div>
    </TourProvider>
    </DeviceProvider>
  );
}
