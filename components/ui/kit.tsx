/**
 * Shared UI building blocks for app screens (specs/DESIGN.md). Server-safe: no hooks, no state.
 * Tokens only (bg-primary, text-on-surface…), so the dark theme keeps working.
 */
import React from 'react';
import Link from 'next/link';

/* ── Class recipes ───────────────────────────────────────────────── */

const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
const btnBase = `inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`;

export const btn = {
  primary: `${btnBase} bg-primary text-on-primary hover:bg-primary/90`,
  accent: `${btnBase} bg-secondary text-on-secondary hover:bg-secondary/90`,
  outline: `${btnBase} border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low`,
  ghost: `${btnBase} px-3 text-secondary hover:bg-secondary/10`,
  danger: `${btnBase} bg-error text-on-error hover:bg-error/90`,
};

export const field = {
  label: 'mb-1.5 block text-[13px] font-semibold text-on-surface',
  hint: 'mt-1 text-[13px] text-on-surface-variant',
  input: `w-full min-h-12 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-[16px] text-on-surface placeholder:text-on-surface-variant/70 transition-colors hover:border-outline focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/25`,
};

export const table = {
  wrap: 'overflow-x-auto',
  table: 'w-full border-collapse text-left text-body-md',
  head: 'bg-surface-container-low',
  th: 'whitespace-nowrap border-b border-outline-variant px-4 py-3 text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant',
  row: 'border-b border-outline-variant/70 last:border-0 transition-colors hover:bg-surface-container-low',
  td: 'px-4 py-3 text-on-surface',
};

/* ── Card ────────────────────────────────────────────────────────── */

export function Card({
  title,
  description,
  icon,
  actions,
  children,
  padded = true,
  className = '',
  id,
  ...rest
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  padded?: boolean;
  className?: string;
  id?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={`overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_1px_2px_rgba(0,29,61,0.04)] ${className}`}
      {...rest}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary" aria-hidden="true">
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 id={headingId} className="font-headline-sm text-[18px] font-semibold leading-tight text-primary">
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-body-md text-on-surface-variant">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children !== undefined && <div className={padded ? 'p-4 md:p-6' : ''}>{children}</div>}
    </section>
  );
}

/* ── Alert ───────────────────────────────────────────────────────── */

const TONES = {
  info: { box: 'border-primary/20 bg-primary-fixed/40 text-on-surface', icon: 'info', iconCls: 'text-primary' },
  warning: { box: 'border-flag/40 bg-flag-container text-on-flag-container', icon: 'warning', iconCls: 'text-flag' },
  error: { box: 'border-error/40 bg-error-container text-on-error-container', icon: 'error', iconCls: 'text-error' },
  success: { box: 'border-secondary/40 bg-success-container text-on-success-container', icon: 'check_circle', iconCls: 'text-secondary' },
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  icon,
  action,
  role,
}: {
  tone?: keyof typeof TONES;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: string;
  action?: React.ReactNode;
  role?: 'alert' | 'status';
}) {
  const t = TONES[tone];
  return (
    <div role={role ?? (tone === 'error' || tone === 'warning' ? 'alert' : 'status')} className={`flex flex-wrap items-start gap-3 rounded-xl border p-4 ${t.box}`}>
      <span className={`material-symbols-outlined icon-fill text-[22px] ${t.iconCls}`} aria-hidden="true">
        {icon ?? t.icon}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-[15px]">{title}</p>}
        {children && <div className={`text-[14px] leading-relaxed ${title ? 'mt-0.5' : ''}`}>{children}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center">{action}</div>}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────── */

export function EmptyState({ icon, title, children, action }: { icon: string; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10 text-secondary" aria-hidden="true">
        <span className="material-symbols-outlined text-[28px]">{icon}</span>
      </span>
      <p className="mt-4 font-headline-sm text-[18px] font-semibold text-primary">{title}</p>
      {children && <div className="mt-1 max-w-md text-body-md text-on-surface-variant">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

/* ── Stat tile ───────────────────────────────────────────────────── */

export function StatTile({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: string }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-[0_1px_2px_rgba(0,29,61,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-on-surface-variant">{label}</p>
        {icon && (
          <span className="material-symbols-outlined text-[20px] text-secondary" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 font-display-lg text-[24px] font-bold leading-tight tracking-tight text-on-surface">{value}</p>
      {hint && <p className="mt-1 text-[13px] text-on-surface-variant">{hint}</p>}
    </div>
  );
}

/* ── Small pieces ────────────────────────────────────────────────── */

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={`inline-flex min-h-10 items-center gap-1 rounded-lg pr-2 text-[14px] font-semibold text-on-surface-variant hover:text-secondary ${focus}`}>
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
        arrow_back
      </span>
      {label}
    </Link>
  );
}

export function Icon({ name, className = '', filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span className={`material-symbols-outlined ${filled ? 'icon-fill' : ''} ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}
