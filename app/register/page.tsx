"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { AlertIcon, ArrowLeftIcon, CheckIcon, EyeIcon, EyeOffIcon, GoogleIcon, Spinner } from "@/components/ui/Icons";
import { ExistingSessionNotice, useRetryAfterStaleSession } from "@/components/auth/session-recovery";

type FieldKey = "firstName" | "lastName" | "email" | "password" | "confirm" | "terms" | "code";
type ClerkError = { errors?: Array<{ code?: string; longMessage?: string; message?: string; meta?: { paramName?: string } }>; message?: string };

const PARAM_TO_FIELD: Record<string, FieldKey> = {
  first_name: "firstName",
  last_name: "lastName",
  email_address: "email",
  password: "password",
  code: "code",
};

const MIN_PASSWORD = 8;

/** Same wording as the landing hero, so the two pages describe the product identically. */
const BRAND_POINTS = [
  { title: "Capture in Field", description: "Dictate audio or type medication findings with minimal internet connectivity." },
  { title: "Organised Reports", description: "Your notes, tidied into a standard record. Nothing added, nothing lost." },
  { title: "PDF Reports", description: "Download signed field reports, ready to print or share." },
];

/** Splits a Clerk error into field-level messages and a general one. */
function readClerkError(err: unknown, fallback: string) {
  const e = err as ClerkError;
  const fields: Partial<Record<FieldKey, string>> = {};
  let general = "";
  for (const item of e.errors ?? []) {
    const msg = item.longMessage || item.message || fallback;
    const field = item.meta?.paramName ? PARAM_TO_FIELD[item.meta.paramName] : undefined;
    if (field && !fields[field]) fields[field] = msg;
    else if (!general) general = msg;
  }
  if (!general && !Object.keys(fields).length) general = e.message || fallback;
  return { fields, general };
}

const inputBase =
  "block w-full h-12 rounded-lg border bg-[#f0f7f6] px-3.5 text-[16px] text-[#0d2240] placeholder:text-[#8fafc0] outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:bg-white focus:border-[#00b896] focus:ring-[3px] focus:ring-[#00b896]/15 disabled:opacity-60";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-[#0d2240]">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-error">
          <AlertIcon size={16} className="mt-px shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="mt-1.5 text-[13px] text-[#3d5a73]">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  describedBy?: string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${inputBase} pr-12 ${invalid ? "border-error" : "border-[#d0e8e4]"}`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-[#8fafc0] hover:bg-[#e0f0ed] hover:text-[#00b896]"
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

export default function RegisterPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const uid = useId();
  const retryAfterStaleSession = useRetryAfterStaleSession();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [step, setStep] = useState<"details" | "verify">("details");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<false | "submit" | "google" | "verify" | "resend">(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [general, setGeneral] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const notReady = () => {
    setGeneral("Still connecting. Check your internet connection and try again in a moment.");
  };

  const validate = () => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!firstName.trim()) e.firstName = "Enter your first name.";
    if (!lastName.trim()) e.lastName = "Enter your last name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = "Enter a valid email address.";
    if (password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (confirm !== password) e.confirm = "The passwords do not match.";
    if (!agreed) e.terms = "Please accept the terms to continue.";
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setGeneral("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`${uid}-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    if (!isLoaded || !signUp) return notReady();
    setBusy("submit");
    try {
      await retryAfterStaleSession(() => signUp.create({ firstName: firstName.trim(), lastName: lastName.trim(), emailAddress: email.trim(), password }));
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
      setResendIn(30);
    } catch (err) {
      const { fields, general: g } = readClerkError(err, "We could not create your account. Please try again.");
      setErrors(fields);
      setGeneral(g);
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setGeneral("");
    if (!isLoaded || !signUp) return notReady();
    setBusy("google");
    try {
      await retryAfterStaleSession(() =>
        signUp.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: "/field-entry" }),
      );
    } catch (err) {
      setGeneral(readClerkError(err, "Google sign-up is not available right now.").general);
      setBusy(false);
    }
  };

  const handleVerify = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setGeneral("");
    if (!/^\d{6}$/.test(code)) return setErrors({ code: "Enter the 6-digit code from the email." });
    if (!isLoaded || !signUp || !setActive) return notReady();
    setBusy("verify");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/field-entry");
        return;
      }
      setErrors({ code: "That code did not complete sign-up. Check it and try again." });
    } catch (err) {
      const { fields, general: g } = readClerkError(err, "That code did not work. Check it and try again.");
      setErrors({ code: fields.code ?? g });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!signUp || resendIn > 0) return;
    setBusy("resend");
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setResendIn(30);
      setGeneral("");
    } catch (err) {
      setGeneral(readClerkError(err, "We could not send a new code.").general);
    } finally {
      setBusy(false);
    }
  };

  const id = (k: FieldKey) => `${uid}-${k}`;
  const describedBy = (k: FieldKey, hasHint = false) => (errors[k] ? `${id(k)}-error` : hasHint ? `${id(k)}-hint` : undefined);
  const lengthOk = password.length >= MIN_PASSWORD;

  return (
    <div className="force-light min-h-dvh bg-[#eef6f5] text-[#0d2240] lg:flex">
      {/* Brand panel: desktop only, stays in view while the form column scrolls on short laptop screens. */}
      <aside
        aria-label="About DaktariScribe"
        className="hero-bg hidden text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[42%] lg:flex-col lg:justify-center lg:overflow-y-auto lg:px-12 lg:py-10 xl:w-1/2 xl:px-20"
      >
        <div className="mx-auto w-full max-w-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
              <Image src="/assets/DaktariScribe-Favicon.png" alt="" width={40} height={40} className="object-contain" />
            </span>
            <span>
              <span className="block text-[16px] font-black uppercase leading-none tracking-[0.22em]">DaktariScribe</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-white/70">Field notes to finished reports</span>
            </span>
          </div>
          <p className="mt-8 font-display-lg text-3xl font-black leading-[1.15] tracking-tight xl:text-4xl">
            Voice and text field notes, turned into <span className="text-[#4dd9c0]">clear clinical reports.</span>
          </p>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
            Capture, organise and report clinical encounters in the field, even with weak internet.
          </p>
          <ul className="mt-8 flex flex-col gap-5">
            {BRAND_POINTS.map((point) => (
              <li key={point.title} className="flex items-start gap-3">
                <CheckIcon size={20} className="mt-0.5 shrink-0 text-[#4dd9c0]" />
                <span>
                  <span className="block text-[15px] font-semibold">{point.title}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-white/75">{point.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col items-center px-4 pb-6 pt-8 sm:px-8 sm:pt-12 lg:pt-8">
        <div className="my-auto w-full max-w-[460px] sm:max-w-[600px] lg:max-w-[560px]">
        <main id="main" className="overflow-hidden rounded-2xl border border-[#d0e8e4] bg-white shadow-2xl shadow-[rgba(0,185,150,0.10)]">
          <div
            className="relative flex flex-col items-center overflow-hidden px-6 pb-7 pt-8 text-center sm:px-10 lg:pb-6 lg:pt-6"
            style={{ background: "linear-gradient(145deg, #0d2240 0%, #1a3a5c 60%, #00956e 100%)" }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse 70% 60% at 50% 120%, rgba(0,185,150,0.28) 0%, transparent 70%)" }}
              aria-hidden="true"
            />
            <Link
              href="/"
              aria-label="DaktariScribe home"
              className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-3 shadow-lg transition-transform hover:scale-[1.03] lg:mb-4 lg:h-16 lg:w-16 lg:p-2"
            >
              <Image src="/assets/DaktariScribe-Favicon.png" alt="DaktariScribe" width={56} height={56} className="object-contain" priority />
            </Link>
            <h1 className="relative font-display-lg text-[26px] font-bold leading-tight tracking-tight text-white sm:text-[30px]">
              {step === "details" ? "Create your account" : "Check your email"}
            </h1>
            <p className="relative mt-1.5 max-w-full text-[15px] text-[#a8f0e6] [overflow-wrap:anywhere]">
              {step === "details" ? (
                "For clinicians and field health workers."
              ) : (
                <>
                  Enter the 6-digit code we sent to <strong className="font-semibold text-white">{email.trim()}</strong>.
                </>
              )}
            </p>
          </div>
          <div className="p-6 sm:p-10 lg:p-8">
          <ExistingSessionNotice />
          {general && (
            <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-error/40 bg-error-container px-3.5 py-3 text-[14px] text-on-error-container">
              <AlertIcon size={18} className="mt-px shrink-0" />
              <span>{general}</span>
            </div>
          )}

          {step === "details" ? (
            <>
              <button
                type="button"
                onClick={continueWithGoogle}
                disabled={busy !== false}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#d0e8e4] bg-white text-[15px] font-semibold text-[#0d2240] hover:border-[#00b896] hover:bg-[#f0f7f6] disabled:opacity-60"
              >
                {busy === "google" ? <Spinner /> : <GoogleIcon />}
                Continue with Google
              </button>

              <div className="my-6 flex items-center gap-3 text-[13px] text-[#8fafc0]" role="separator">
                <span className="h-px flex-1 bg-[#e0f0ed]" />
                or with your email
                <span className="h-px flex-1 bg-[#e0f0ed]" />
              </div>

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id={id("firstName")} label="First name" error={errors.firstName}>
                    <input
                      id={id("firstName")}
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      aria-invalid={!!errors.firstName || undefined}
                      aria-describedby={describedBy("firstName")}
                      className={`${inputBase} ${errors.firstName ? "border-error" : "border-[#d0e8e4]"}`}
                    />
                  </Field>
                  <Field id={id("lastName")} label="Last name" error={errors.lastName}>
                    <input
                      id={id("lastName")}
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      aria-invalid={!!errors.lastName || undefined}
                      aria-describedby={describedBy("lastName")}
                      className={`${inputBase} ${errors.lastName ? "border-error" : "border-[#d0e8e4]"}`}
                    />
                  </Field>
                </div>

                <Field id={id("email")} label="Email" error={errors.email}>
                  <input
                    id={id("email")}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!errors.email || undefined}
                    aria-describedby={describedBy("email")}
                    className={`${inputBase} ${errors.email ? "border-error" : "border-[#d0e8e4]"}`}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  id={id("password")}
                  label="Password"
                  error={errors.password}
                  hint={
                    <span className={`inline-flex items-center gap-1.5 ${lengthOk ? "text-[#00957a]" : ""}`}>
                      {lengthOk ? <CheckIcon size={16} /> : <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
                      At least {MIN_PASSWORD} characters
                    </span>
                  }
                >
                  <PasswordInput
                    id={id("password")}
                    value={password}
                    onChange={setPassword}
                    invalid={!!errors.password}
                    describedBy={describedBy("password", true)}
                    autoComplete="new-password"
                  />
                </Field>

                <Field
                  id={id("confirm")}
                  label="Confirm password"
                  error={errors.confirm}
                  hint={
                    confirm && confirm === password ? (
                      <span className="inline-flex items-center gap-1.5 text-[#00957a]">
                        <CheckIcon size={16} /> Passwords match
                      </span>
                    ) : null
                  }
                >
                  <PasswordInput
                    id={id("confirm")}
                    value={confirm}
                    onChange={setConfirm}
                    invalid={!!errors.confirm}
                    describedBy={describedBy("confirm", Boolean(confirm && confirm === password))}
                    autoComplete="new-password"
                  />
                </Field>
                </div>

                <div>
                  <label htmlFor={id("terms")} className="flex cursor-pointer items-start gap-3 py-1">
                    <input
                      id={id("terms")}
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      aria-invalid={!!errors.terms || undefined}
                      aria-describedby={describedBy("terms")}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[#0d2240]"
                    />
                    <span className="text-[14px] leading-6 text-[#3d5a73]">
                      I agree to the{" "}
                      <Link href="/legal/terms" target="_blank" className="font-semibold text-[#00957a] underline-offset-2 hover:underline">
                        Terms
                      </Link>{" "}
                      and{" "}
                      <Link href="/legal/privacy" target="_blank" className="font-semibold text-[#00957a] underline-offset-2 hover:underline">
                        Privacy Policy
                      </Link>
                      , and I understand that I review and sign off every report before it is final.
                    </span>
                  </label>
                  {errors.terms && (
                    <p id={`${id("terms")}-error`} className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-error">
                      <AlertIcon size={16} />
                      {errors.terms}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={busy !== false}
                  className="btn-ds-primary mt-1"
                >
                  {busy === "submit" ? (
                    <>
                      <Spinner /> Creating account…
                    </>
                  ) : (
                    "Create account"
                  )}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleVerify} noValidate className="flex flex-col gap-5">
              <Field id={id("code")} label="Verification code" error={errors.code}>
                <input
                  id={id("code")}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setErrors({});
                  }}
                  aria-invalid={!!errors.code || undefined}
                  aria-describedby={describedBy("code")}
                  className={`${inputBase} text-center font-label-status text-[22px] tracking-[0.5em] ${errors.code ? "border-error" : "border-[#d0e8e4]"}`}
                />
              </Field>
              <button
                type="submit"
                disabled={busy !== false}
                className="btn-ds-primary"
              >
                {busy === "verify" ? (
                  <>
                    <Spinner /> Verifying…
                  </>
                ) : (
                  "Verify and continue"
                )}
              </button>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
                <button
                  type="button"
                  onClick={() => {
                    setStep("details");
                    setCode("");
                    setErrors({});
                  }}
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-2 font-semibold text-[#3d5a73] hover:text-[#0d2240]"
                >
                  <ArrowLeftIcon size={18} /> Use a different email
                </button>
                <button
                  type="button"
                  onClick={resend}
                  disabled={resendIn > 0 || busy !== false}
                  className="min-h-12 rounded-lg px-2 font-semibold text-[#00957a] hover:underline disabled:text-[#8fafc0] disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : busy === "resend" ? "Sending…" : "Resend code"}
                </button>
              </div>
            </form>
          )}
          </div>
        </main>

        {step === "details" && (
          <p className="mt-6 text-center text-[14px] text-[#3d5a73]">
            Already have an account?{" "}
            <Link href="/" className="font-semibold text-[#00957a] underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        )}
        </div>
        <p className="pt-8 text-center text-[12px] uppercase tracking-widest text-[#8fafc0]">© 2026 DaktariScribe</p>
      </div>
    </div>
  );
}
