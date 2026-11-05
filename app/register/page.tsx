"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useRouter } from "next/navigation";
import { AlertIcon, ArrowLeftIcon, CheckIcon, EyeIcon, EyeOffIcon, GoogleIcon, Spinner } from "@/components/ui/Icons";

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
  "block w-full h-12 rounded-lg border bg-surface-container-lowest px-3.5 text-[16px] text-on-surface placeholder:text-on-surface-variant/70 outline-none transition-[border-color,box-shadow] duration-150 focus:border-secondary focus:ring-[3px] focus:ring-secondary/25 disabled:opacity-60";

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
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-on-surface">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-error">
          <AlertIcon size={16} className="mt-px shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="mt-1.5 text-[13px] text-on-surface-variant">
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
        className={`${inputBase} pr-12 ${invalid ? "border-error" : "border-outline"}`}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
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
      await signUp.create({ firstName: firstName.trim(), lastName: lastName.trim(), emailAddress: email.trim(), password });
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
      await signUp.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: "/field-entry" });
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
    <div className="force-light min-h-screen bg-surface text-on-surface">
      <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col px-4 py-8 sm:py-12">
        <Link href="/" className="mb-8 inline-flex items-center gap-2.5 self-start rounded-lg" aria-label="DaktariScribe home">
          <Image src="/assets/report-mark.png" alt="" width={36} height={36} priority />
          <span className="font-display-lg text-[20px] font-bold tracking-tight text-primary">DaktariScribe</span>
        </Link>

        <main id="main" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgba(0,29,61,0.06)] sm:p-8">
          {general && (
            <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-error/40 bg-error-container px-3.5 py-3 text-[14px] text-on-error-container">
              <AlertIcon size={18} className="mt-px shrink-0" />
              <span>{general}</span>
            </div>
          )}

          {step === "details" ? (
            <>
              <h1 className="font-display-lg text-[26px] font-bold leading-tight tracking-tight text-primary">Create your account</h1>
              <p className="mt-1.5 text-[15px] text-on-surface-variant">For clinicians and field health workers.</p>

              <button
                type="button"
                onClick={continueWithGoogle}
                disabled={busy !== false}
                className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-outline bg-surface-container-lowest text-[15px] font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-60"
              >
                {busy === "google" ? <Spinner /> : <GoogleIcon />}
                Continue with Google
              </button>

              <div className="my-6 flex items-center gap-3 text-[13px] text-on-surface-variant" role="separator">
                <span className="h-px flex-1 bg-outline-variant" />
                or with your email
                <span className="h-px flex-1 bg-outline-variant" />
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
                      className={`${inputBase} ${errors.firstName ? "border-error" : "border-outline"}`}
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
                      className={`${inputBase} ${errors.lastName ? "border-error" : "border-outline"}`}
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
                    className={`${inputBase} ${errors.email ? "border-error" : "border-outline"}`}
                  />
                </Field>

                <Field
                  id={id("password")}
                  label="Password"
                  error={errors.password}
                  hint={
                    <span className={`inline-flex items-center gap-1.5 ${lengthOk ? "text-secondary" : ""}`}>
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
                      <span className="inline-flex items-center gap-1.5 text-secondary">
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

                <div>
                  <label htmlFor={id("terms")} className="flex cursor-pointer items-start gap-3 py-1">
                    <input
                      id={id("terms")}
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      aria-invalid={!!errors.terms || undefined}
                      aria-describedby={describedBy("terms")}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[var(--color-primary)]"
                    />
                    <span className="text-[14px] leading-6 text-on-surface">
                      I agree to the{" "}
                      <Link href="/legal/terms" target="_blank" className="font-semibold text-secondary underline-offset-2 hover:underline">
                        Terms
                      </Link>{" "}
                      and{" "}
                      <Link href="/legal/privacy" target="_blank" className="font-semibold text-secondary underline-offset-2 hover:underline">
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
                  className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[15px] font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-70"
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
              <div>
                <h1 className="font-display-lg text-[26px] font-bold leading-tight tracking-tight text-primary">Check your email</h1>
                <p className="mt-1.5 text-[15px] text-on-surface-variant">
                  Enter the 6-digit code we sent to <strong className="font-semibold text-on-surface">{email.trim()}</strong>.
                </p>
              </div>
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
                  className={`${inputBase} text-center font-label-status text-[22px] tracking-[0.5em] ${errors.code ? "border-error" : "border-outline"}`}
                />
              </Field>
              <button
                type="submit"
                disabled={busy !== false}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[15px] font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-70"
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
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-2 font-semibold text-on-surface-variant hover:text-on-surface"
                >
                  <ArrowLeftIcon size={18} /> Use a different email
                </button>
                <button
                  type="button"
                  onClick={resend}
                  disabled={resendIn > 0 || busy !== false}
                  className="min-h-12 rounded-lg px-2 font-semibold text-secondary hover:underline disabled:text-on-surface-variant disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : busy === "resend" ? "Sending…" : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </main>

        {step === "details" && (
          <p className="mt-6 text-center text-[14px] text-on-surface-variant">
            Already have an account?{" "}
            <Link href="/" className="font-semibold text-secondary underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        )}
        <p className="mt-auto pt-10 text-center text-[12px] text-on-surface-variant">© 2026 DaktariScribe</p>
      </div>
    </div>
  );
}
