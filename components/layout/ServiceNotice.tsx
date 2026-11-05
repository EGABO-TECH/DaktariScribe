import React from 'react';

/** Shown when the records database is not configured or unreachable. No technical detail leaks. */
export default function ServiceNotice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-flag bg-flag-container p-5 text-on-flag-container">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
          warning
        </span>
        <div>
          <h2 className="font-semibold text-[16px]">{title}</h2>
          {children ? <div className="mt-1 text-[14px]">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
