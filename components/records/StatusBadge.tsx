import React from 'react';

/** Status badges carry an icon and text as well as colour (spec §1.4). */
export type BadgeStatus =
  | 'draft'
  | 'processing'
  | 'in_review'
  | 'final'
  | 'saved_on_device'
  | 'uploading'
  | 'transcribing';

const META: Record<BadgeStatus, { icon: string; label: string; cls: string }> = {
  saved_on_device: { icon: 'save', label: 'Saved on device', cls: 'bg-surface-container-high text-on-surface border-outline' },
  uploading: { icon: 'cloud_upload', label: 'Uploading', cls: 'bg-primary-fixed text-on-primary-fixed border-primary-fixed-dim' },
  transcribing: { icon: 'graphic_eq', label: 'Transcribing', cls: 'bg-primary-fixed text-on-primary-fixed border-primary-fixed-dim' },
  draft: { icon: 'edit_note', label: 'Draft', cls: 'bg-surface-container-high text-on-surface border-outline' },
  processing: { icon: 'hourglass_top', label: 'Processing', cls: 'bg-primary-fixed text-on-primary-fixed border-primary-fixed-dim' },
  in_review: { icon: 'rate_review', label: 'Ready for review', cls: 'bg-flag-container text-on-flag-container border-flag' },
  final: { icon: 'verified', label: 'Final', cls: 'bg-success-container text-on-success-container border-success' },
};

export function statusLabel(status: BadgeStatus): string {
  return META[status].label;
}

export default function StatusBadge({ status, className = '' }: { status: BadgeStatus; className?: string }) {
  const m = META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-semibold leading-5 ${m.cls} ${className}`}
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
        {m.icon}
      </span>
      {m.label}
    </span>
  );
}
