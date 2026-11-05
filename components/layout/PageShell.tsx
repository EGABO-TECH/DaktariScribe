import React from 'react';

/** Standard scrolling page container for dashboard screens. */
export default function PageShell({
  title,
  description,
  actions,
  children,
  width = 'max-w-7xl',
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <main id="main" className="flex-1 overflow-y-auto bg-surface px-margin-mobile py-6 pb-24 md:px-margin-desktop lg:pb-margin-desktop">
      <div className={`${width} mx-auto flex flex-col gap-gutter`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-primary">{title}</h1>
            {description ? <p className="mt-1 text-body-lg text-on-surface-variant">{description}</p> : null}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </main>
  );
}
