import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";

interface LegalPageLayoutProps {
  title: string;
  badge: string;
  badgeIcon: string;
  lastUpdated: string;
  children: ReactNode;
}

export default function LegalPageLayout({
  title,
  badge,
  badgeIcon,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[#eef6f5]">
      {/* ── Top Nav Bar ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#d0e8e4] shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/assets/DaktariScribe-Favicon.png"
              alt="DaktariScribe"
              width={32}
              height={32}
              className="object-contain"
            />
            <span
              className="text-[15px] font-black tracking-[0.16em] uppercase"
              style={{
                background: "linear-gradient(90deg, #0d2240 0%, #00b896 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              DaktariScribe
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3d5a73] hover:text-[#00b896] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Home
          </Link>
        </div>
      </nav>

      {/* ── Hero Banner ── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #0d2240 0%, #1a3a5c 55%, #00956e 100%)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 80% 50%, rgba(0,185,150,0.18) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-14">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.22em] uppercase text-[#4dd9c0] bg-white/10 border border-white/15 rounded-full px-3 py-1.5 mb-5">
            <span className="material-symbols-outlined text-[13px]">{badgeIcon}</span>
            {badge}
          </span>
          <h1 className="text-white font-extrabold text-3xl md:text-4xl leading-tight mb-3">
            {title}
          </h1>
          <p className="text-white/55 text-[12px] tracking-widest uppercase font-medium">
            DaktariScribe Pharma Network &nbsp;·&nbsp; Last updated: {lastUpdated}
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-md shadow-[rgba(0,185,150,0.07)] border border-[#d0e8e4] px-8 md:px-12 py-10">
          <div className="prose prose-slate max-w-none legal-prose">
            {children}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="max-w-4xl mx-auto px-6 pb-12 text-center">
        <p className="text-[10px] uppercase tracking-widest text-[#8fafc0]">
          © 2026 DaktariScribe Clinical Pharma Network. All rights reserved.
        </p>
      </div>
    </div>
  );
}
