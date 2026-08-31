"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

/** Google "G" SVG logo */
function GoogleLogo() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginSection() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const handleGoogleSSO = async () => {
    if (!isLoaded) return;
    await signIn.authenticateWithRedirect({
      strategy: "oauth_google",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/field-entry");
      } else {
        // Handle incomplete sign-in (requires 2FA, etc.)
        setError("Additional verification steps are required.");
      }
    } catch (err: any) {
      // Better error handling
      const errorMessage = err.errors?.[0]?.longMessage || err.message || "Failed to sign in. Please check your credentials.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      className="
        w-full lg:w-1/2
        bg-[#f0f7f6]
        flex items-center justify-center
        relative px-4 sm:px-6 py-10 lg:py-0
        lg:min-h-screen
        overflow-hidden
      "
      aria-label="Sign in to DaktariScribe"
    >
      {/* Subtle decorative blobs */}
      <div
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(0,185,150,0.18) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full pointer-events-none opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(13,34,64,0.14) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="w-full max-w-md relative z-10">
        {/* ── Card ── */}
        <div className="bg-white rounded-2xl shadow-xl shadow-[rgba(0,185,150,0.08)] border border-[#d0e8e4] p-6 md:p-8">
          {/* Favicon top */}
          <div className="flex justify-center mb-5">
            <Image
              src="/assets/DaktariScribe-Favicon.png"
              alt="DaktariScribe"
              width={56}
              height={56}
              className="object-contain"
            />
          </div>

          {/* Headings */}
          <h2 className="text-[#0d2240] text-2xl font-extrabold text-center leading-tight mb-1">
            Welcome back
          </h2>
          <p className="text-[#3d5a73] text-sm text-center mb-6 opacity-85">
            Access your DaktariScribe account to continue.
          </p>

          {/* Google SSO */}
          <button
            id="google-sso-btn"
            type="button"
            onClick={handleGoogleSSO}
            className="
              w-full flex items-center justify-center gap-3
              bg-white border border-[#d0e8e4]
              py-3 px-5 rounded-xl
              text-[#0d2240] font-semibold text-sm
              hover:bg-[#f0f7f6] hover:border-[#00b896]
              active:scale-[0.98]
              transition-all duration-200
              shadow-sm
            "
          >
            <GoogleLogo />
            Continue with Google
          </button>

          {/* OR divider */}
          <div className="ds-divider">
            <span>Or use email</span>
          </div>

          {/* Sign-In Form */}
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 text-error rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[10px] font-bold tracking-[0.14em] uppercase text-[#3d5a73]"
              >
                Email Address
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8fafc0] text-[20px] pointer-events-none"
                  aria-hidden="true"
                >
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@gmail.com"
                  className="ds-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="password"
                  className="block text-[10px] font-bold tracking-[0.14em] uppercase text-[#3d5a73]"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#00b896] hover:underline"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8fafc0] text-[20px] pointer-events-none"
                  aria-hidden="true"
                >
                  lock
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="ds-input pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  id="toggle-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="
                    material-symbols-outlined
                    absolute right-3.5 top-1/2 -translate-y-1/2
                    text-[#8fafc0] hover:text-[#00b896]
                    text-[20px] transition-colors cursor-pointer
                  "
                >
                  {showPassword ? "visibility_off" : "visibility"}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="signin-submit"
              type="submit"
              disabled={isLoading || !isLoaded}
              className="btn-ds-primary mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-[18px]">
                    progress_activity
                  </span>
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <span className="material-symbols-outlined text-[18px]">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[#3d5a73]">
              New to DaktariScribe?{" "}
              <Link
                href="/register"
                className="text-[#00b896] font-bold hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-[10px] uppercase tracking-widest text-[#8fafc0]">
          © 2026 DaktariScribe Clinical Network. All rights reserved.
        </p>
      </div>
    </section>
  );
}
