import React from 'react';
import { BackLink } from '@/components/ui/kit';

/** Standard scrolling page container for dashboard screens: page header, then content. */
export default function PageShell({
  title,
  description,
  actions,
  children,
  icon,
  back,
  width = 'max-w-7xl',
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Material Symbols name shown in a tile beside the title. */
  icon?: string;
  /** Parent page link shown above the title. */
  back?: { href: string; label: string };
  width?: string;
}) {
  return (
    <main id="main" className="flex-1 overflow-y-auto bg-surface px-margin-mobile pb-24 pt-5 md:px-margin-desktop md:pt-8 lg:pb-margin-desktop">
      <div className={`${width} mx-auto flex flex-col gap-6`}>
        <header className="flex flex-col gap-3">
          {back && (
            <div className="-ml-0.5">
              <BackLink href={back.href} label={back.label} />
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              {icon && (
                <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm sm:flex" aria-hidden="true">
                  <span className="material-symbols-outlined text-[24px]">{icon}</span>
                </span>
              )}
              <div className="min-w-0">
                <h1 className="font-display-lg text-display-lg-mobile tracking-tight text-primary md:text-display-lg">{title}</h1>
                {description ? <p className="mt-1 max-w-3xl text-body-lg text-on-surface-variant">{description}</p> : null}
              </div>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
