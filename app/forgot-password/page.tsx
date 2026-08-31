"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const { signIn } = useSignIn();
  const { isLoaded } = useAuth();
  const clerk = useClerk();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [successfulCreation, setSuccessfulCreation] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const requestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setIsLoading(true);
    setError("");
    try {
      // For password reset, we need to identify the user first
      await signIn.create({
        identifier: email,
      });

      // Then prepare the email reset
      await signIn.prepareEmailAddressVerification({ strategy: "email_code" });

      setSuccessfulCreation(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || "Failed to initiate password reset");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoaded) return;
    setIsLoading(true);
    setError("");
    try {
      // Step 1: Verify the email code
      await signIn.attemptEmailAddressVerification({
        code,
      });

      // Step 2: Authenticate with the email and new password
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        // Step 3: Set the active session
        await clerk.setActive({ session: result.createdSessionId });
        router.push("/field-entry");
      } else {
        // Handle incomplete sign-in (shouldn't happen in this flow usually)
        setError("Additional verification steps are required.");
      }
    } catch (err: any) {
      // Better error handling
      const errorMessage = err.errors?.[0]?.longMessage || err.message || "Failed to reset password";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef6f5] flex items-start sm:items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-[480px]">
        <div className="bg-white rounded-3xl shadow-2xl shadow-[rgba(0,185,150,0.10)] overflow-hidden border border-[#d0e8e4]">
          <div
            className="relative flex flex-col items-center text-center px-6 sm:px-8 pt-8 sm:pt-10 pb-7 sm:pb-9 overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #0d2240 0%, #1a3a5c 60%, #00956e 100%)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 70% 60% at 50% 120%, rgba(0,185,150,0.28) 0%, transparent 70%)",
              }}
              aria-hidden="true"
            />
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
            <h1 className="relative z-10 text-white font-extrabold text-[19px] sm:text-[22px] leading-tight tracking-tight mb-1">
              Reset Your Password
            </h1>
            <p className="relative z-10 text-[#a8f0e6] text-[13px] font-medium mb-3">
              DaktariScribe System Portal
            </p>
          </div>

          {!successfulCreation ? (
            <form onSubmit={requestPasswordReset} noValidate className="px-5 sm:px-8 py-7 sm:py-8 space-y-7">
              {error && (
                <div className="p-3 bg-error/10 border border-error/20 text-error rounded-lg text-sm text-center">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="reset-email"
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
                    id="reset-email"
                    type="email"
                    placeholder="name@gmail.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="reg-input"
                    style={{ paddingLeft: '2.75rem', paddingRight: '1rem', width: '100%', height: '50px', border: '1px solid #d0e8e4', borderRadius: '12px', outline: 'none' }}
                  />
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <button
                  type="submit"
                  disabled={isLoading || !isLoaded}
                  className="
                    w-full flex items-center justify-center gap-2
                    py-4 px-6 rounded-xl
                    font-bold text-[15px] text-white
                    bg-[#0d2240]
                    hover:bg-[#1a3a5c]
                    active:scale-[0.985]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200
                    shadow-lg shadow-[rgba(13,34,64,0.25)]
                  "
                >
                  {isLoading ? "Sending..." : "Send Reset Code"}
                </button>
                <Link
                  href="/"
                  className="
                    w-full flex items-center justify-center gap-1.5
                    py-3 text-[13px] font-semibold
                    text-[#3d5a73] hover:text-[#00b896]
                    transition-colors duration-200
                  "
                >
                  Back to Login
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={resetPassword} noValidate className="px-5 sm:px-8 py-7 sm:py-8 space-y-7">
              {error && (
                <div className="p-3 bg-error/10 border border-error/20 text-error rounded-lg text-sm text-center">
                  {error}
                </div>
              )}

              <div>
                <p className="text-center text-sm text-[#3d5a73] mb-6">
                  Check your email for the 6-digit reset code.
                </p>
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="code"
                      className="block text-[10px] font-bold tracking-[0.16em] uppercase text-[#3d5a73] mb-1.5"
                    >
                      Verification Code
                    </label>
                    <input
                      id="code"
                      type="text"
                      placeholder="123456"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="reg-input tracking-widest text-center text-lg"
                      style={{ width: '100%', height: '50px', border: '1px solid #d0e8e4', borderRadius: '12px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-password"
                      className="block text-[10px] font-bold tracking-[0.16em] uppercase text-[#3d5a73] mb-1.5"
                    >
                      New Password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="reg-input"
                      style={{ paddingLeft: '1rem', paddingRight: '1rem', width: '100%', height: '50px', border: '1px solid #d0e8e4', borderRadius: '12px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="
                  w-full flex items-center justify-center gap-2
                  py-4 px-6 rounded-xl
                  font-bold text-[15px] text-white
                  bg-[#0d2240]
                  hover:bg-[#1a3a5c]
                  active:scale-[0.985]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                  shadow-lg shadow-[rgba(13,34,64,0.25)]
                "
              >
                {isLoading ? "Resetting..." : "Reset Password & Login"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}