"use client";

import Image from "next/image";
import FeatureCard from "./FeatureCard";

const FEATURES = [
  {
    icon: "mic",
    title: "Capture in Field",
    description:
      "Dictate audio or type medication findings with minimal internet connectivity.",
    delay: 100,
  },
  {
    icon: "folder_open",
    title: "Modular Templates",
    description:
      "Name and group encounters locally by title and camp location.",
    delay: 200,
  },
  {
    icon: "smart_toy",
    title: "AI Synthesis",
    description:
      "Multi-model pipeline stabilises jargon and aggregates clinical findings.",
    delay: 300,
  },
  {
    icon: "picture_as_pdf",
    title: "PDF Reports",
    description:
      "Download clinician-ready summaries and medical charts instantly.",
    delay: 400,
  },
];

/** Animated waveform spectrum bars next to the eyebrow pill */
function SpectrumBars() {
  const delays = [0.1, 0.3, 0.6, 0.2, 0.5, 0.8, 0.4];
  return (
    <span className="flex items-end gap-[2px] h-4" aria-hidden="true">
      {delays.map((d, i) => (
        <span
          key={i}
          className="ds-wave-bar"
          style={{
            height: "100%",
            animationDelay: `${d}s`,
            animationDuration: `${1.1 + (i % 3) * 0.2}s`,
          }}
        />
      ))}
    </span>
  );
}

export default function HeroSection() {
  return (
    <section
      className="
        w-full lg:w-1/2
        relative overflow-hidden
        flex flex-col justify-center
        px-6 sm:px-8 lg:px-14
        py-10 lg:py-14
        min-h-[60vh] lg:min-h-screen
      "
      aria-label="DaktariScribe brand and features"
    >
      {/* ── Hero Background ── */}
      <div className="absolute inset-0 hero-bg z-0" />

      {/* ── Gradient fade overlays for depth ── */}
      <div
        className="absolute inset-x-0 bottom-0 h-40 pointer-events-none z-10"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(0,26,26,0.55))",
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-20 pointer-events-none z-10"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(6,15,26,0.30))",
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-20 max-w-xl flex flex-col gap-5">
        {/* Brand Row */}
        <div className="flex items-center gap-3 ds-fade-up" style={{ animationDelay: "0ms" }}>
          <div className="w-11 h-11 glass-card rounded-xl flex items-center justify-center text-white flex-shrink-0 p-1">
            <Image
              src="/assets/DaktariScribe-Favicon.png"
              alt="DaktariScribe"
              width={40}
              height={40}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <div className="text-[16px] font-black text-white tracking-[0.22em] uppercase leading-none">
              DaktariScribe
            </div>
            <div className="text-[9px] text-white/55 tracking-[0.24em] uppercase mt-0.5">
              Voice-First Clinical Intelligence
            </div>
          </div>
        </div>

        {/* Eyebrow Pill */}
        <div
          className="ds-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          <span className="inline-flex items-center gap-2 self-start bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-[11px] font-semibold tracking-[0.16em] uppercase px-3.5 py-1.5 rounded-full shadow-sm">
            <span className="material-symbols-outlined text-[13px] text-[#4dd9c0]">
              clinical_notes
            </span>
            Frontline Health AI
            <SpectrumBars />
          </span>
        </div>

        {/* H1 Heading */}
        <h1
          className="font-black text-white leading-[1.15] drop-shadow-md tracking-tight text-2xl sm:text-3xl xl:text-4xl ds-fade-up"
          style={{ animationDelay: "160ms" }}
        >
          AI-Powered Voice &amp; Text{" "}
          <span className="name-gradient">Medical Scribe</span>
          <br />
          for Frontline Healthcare Workers and Field Medics
          <span className="text-[#4dd9c0]">.</span>
        </h1>

        {/* Tagline */}
        <p
          className="text-white/72 text-[15px] leading-relaxed max-w-md -mt-1 ds-fade-up"
          style={{ animationDelay: "220ms" }}
        >
          Capture, synthesise, and report clinical encounters in the field with minimal internet connectivity, at the speed of care.
        </p>

        {/* 2 × 2 Feature Bento Grid — 1-col on very small screens, 2-col on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          {FEATURES.map((feat) => (
            <FeatureCard key={feat.icon} {...feat} />
          ))}
        </div>

        {/* Trust badges */}
        <div
          className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2 ds-fade-up"
          style={{ animationDelay: "500ms" }}
        >
          {[
            { icon: "lock", label: "Encrypted" },
            { icon: "wifi_off", label: "Offline-Ready" },
            { icon: "verified", label: "Clinician-Vetted" },
          ].map(({ icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1 text-white/60 text-[10.5px] font-semibold tracking-wide uppercase"
            >
              <span className="material-symbols-outlined text-[13px] text-[#4dd9c0]">
                {icon}
              </span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
