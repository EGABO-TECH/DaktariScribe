"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) return;
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#eef6f5] flex items-start sm:items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-[480px]">

        {/* ── Card ── */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-[rgba(0,185,150,0.10)] overflow-hidden border border-[#d0e8e4]">

          {/* ══ HEADER BANNER ══ */}
          <div
            className="relative flex flex-col items-center text-center px-6 sm:px-8 pt-8 sm:pt-10 pb-7 sm:pb-9 overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #0d2240 0%, #1a3a5c 60%, #00956e 100%)",
            }}
          >
            {/* Subtle radial glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% 120%, rgba(0,185,150,0.28) 0%, transparent 70%)",
              }}
              aria-hidden="true"
            />

            {/* Logo tile */}
            <div className="relative z-10 bg-white rounded-2xl p-3 shadow-lg mb-5 w-20 h-20 flex items-center justify-center">
              <Image
                src="/assets/DaktariScribe-Favicon.png"
                alt="DaktariScribe Logo"
                width={56}
                height={56}
                className="object-contain"
                priority
              />
            </div>

            {/* Titles */}
            <h1 className="relative z-10 text-white font-extrabold text-[19px] sm:text-[22px] leading-tight tracking-tight mb-1">
              DaktariScribe Pharma Network
            </h1>
            <p className="relative z-10 text-[#a8f0e6] text-[13px] font-medium mb-3">
              System Portal Sign Up Form
            </p>

            {/* Eyebrow caption */}
            <span className="relative z-10 inline-block text-white/55 text-[10px] font-semibold tracking-[0.22em] uppercase border-t border-white/15 pt-3 w-full text-center">
              Capture your identity markers to begin
            </span>
          </div>

          {/* ══ FORM BODY ══ */}
          <form onSubmit={handleSubmit} noValidate className="px-5 sm:px-8 py-7 sm:py-8 space-y-7">

            {/* ── Section: Primary Identity ── */}
            <div>
              <h2 className="text-[#0d2240] font-extrabold text-[17px] mb-1 pb-2 border-b border-[#e0f0ed]">
                Primary Identity
              </h2>

              <div className="mt-5 space-y-4">
                {/* First Name */}
                <div>
                  <label
                    htmlFor="first-name"
                    className="block text-[10px] font-bold tracking-[0.16em] uppercase text-[#3d5a73] mb-1.5"
                  >
                    First Name
                  </label>
                  <input
                    id="first-name"
                    type="text"
                    autoComplete="given-name"
                    required
                    className="reg-input"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label
                    htmlFor="last-name"
                    className="block text-[10px] font-bold tracking-[0.16em] uppercase text-[#3d5a73] mb-1.5"
                  >
                    Last Name
                  </label>
                  <input
                    id="last-name"
                    type="text"
                    autoComplete="family-name"
                    required
                    className="reg-input"
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-[10px] font-bold tracking-[0.16em] uppercase text-[#3d5a73] mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <span
                      className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8fafc0] text-[19px] pointer-events-none"
                      aria-hidden="true"
                    >
                      mail
                    </span>
                    <input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@gmail.com"
                      required
                      className="reg-input"
                      style={{ paddingLeft: '2.75rem' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section: Security & Access ── */}
            <div>
              <h2 className="text-[#0d2240] font-extrabold text-[17px] mb-1 pb-2 border-b border-[#e0f0ed]">
                Security &amp; Access
              </h2>

              <div className="mt-5 space-y-4">
                {/* Password */}
                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-[10px] font-bold tracking-[0.16em] uppercase text-[#3d5a73] mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <span
                      className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8fafc0] text-[19px] pointer-events-none"
                      aria-hidden="true"
                    >
                      lock
                    </span>
                    <input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="........"
                      required
                      className="reg-input"
                      style={{ paddingLeft: '2.75rem', paddingRight: '3rem' }}
                    />
                    <button
                      type="button"
                      id="toggle-reg-password"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8fafc0] hover:text-[#00b896] text-[19px] cursor-pointer transition-colors"
                    >
                      {showPassword ? "visibility_off" : "visibility"}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="reg-confirm"
                    className="block text-[10px] font-bold tracking-[0.16em] uppercase text-[#3d5a73] mb-1.5"
                  >
                    Confirm
                  </label>
                  <div className="relative">
                    <span
                      className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8fafc0] text-[19px] pointer-events-none"
                      aria-hidden="true"
                    >
                      lock
                    </span>
                    <input
                      id="reg-confirm"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="........"
                      required
                      className="reg-input"
                      style={{ paddingLeft: '2.75rem', paddingRight: '3rem' }}
                    />
                    <button
                      type="button"
                      id="toggle-reg-confirm"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      onClick={() => setShowConfirm((v) => !v)}
                      className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8fafc0] hover:text-[#00b896] text-[19px] cursor-pointer transition-colors"
                    >
                      {showConfirm ? "visibility_off" : "visibility"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Terms & Conditions Checkbox ── */}
            <div className="pt-2 pb-1">
              <label
                htmlFor="terms-agree"
                className="flex items-start gap-3 cursor-pointer group"
              >
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    id="terms-agree"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="sr-only peer"
                    required
                  />
                  {/* Custom checkbox face */}
                  <div
                    className="
                      w-5 h-5 rounded-md border-2 border-[#d0e8e4]
                      bg-white peer-checked:bg-[#0d2240] peer-checked:border-[#0d2240]
                      group-hover:border-[#00b896]
                      transition-all duration-200
                      flex items-center justify-center
                    "
                    onClick={() => setAgreedToTerms((v) => !v)}
                    aria-hidden="true"
                  >
                    {agreedToTerms && (
                      <span className="material-symbols-outlined text-white text-[14px] font-bold">
                        check
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[13px] text-[#3d5a73] leading-snug select-none">
                  I have read and agree to the{" "}
                  <Link
                    href="/legal/terms"
                    target="_blank"
                    className="text-[#00b896] font-semibold hover:underline"
                  >
                    Terms of Service
                  </Link>
                  {" "}and{" "}
                  <Link
                    href="/legal/privacy"
                    target="_blank"
                    className="text-[#00b896] font-semibold hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  . I understand that AI-generated outputs must be validated by a licensed clinician.
                </span>
              </label>
            </div>

            {/* ── Actions ── */}
            <div className="space-y-3 pt-1">
              {/* Submit */}
              <button
                id="register-submit"
                type="submit"
                disabled={isLoading || !agreedToTerms}
                className="
                  w-full flex items-center justify-center gap-2
                  py-4 px-6 rounded-xl
                  font-bold text-[15px] text-white
                  bg-[#0d2240]
                  hover:bg-[#1a3a5c]
                  active:scale-[0.985]
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#0d2240]
                  transition-all duration-200
                  shadow-lg shadow-[rgba(13,34,64,0.25)]
                "
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin material-symbols-outlined text-[18px]">
                      progress_activity
                    </span>
                    Registering…
                  </>
                ) : (
                  <>
                    Finish Account Registration
                    <span className="material-symbols-outlined text-[18px]">
                      how_to_reg
                    </span>
                  </>
                )}
              </button>

              {/* Back to Login */}
              <Link
                href="/"
                id="back-to-login"
                className="
                  w-full flex items-center justify-center gap-1.5
                  py-3 text-[13px] font-semibold
                  text-[#3d5a73] hover:text-[#00b896]
                  transition-colors duration-200
                "
              >
                <span className="material-symbols-outlined text-[16px]">
                  arrow_back
                </span>
                Back to Login
              </Link>
            </div>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-[10px] uppercase tracking-widest text-[#8fafc0]">
          © 2026 DaktariScribe Clinical Network. All rights reserved.
        </p>
      </div>
    </div>
  );
}
