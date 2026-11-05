'use client';

import React, { useState } from 'react';

/**
 * Playback / viewing of an original recording or uploaded file. Media is fetched from an
 * authenticated route only when the worker asks for it (no prefetch, no shareable link).
 */
export default function SourceMedia({ sourceId, kind, files, mimeType }: { sourceId: string; kind: string; files: number; mimeType: string | null }) {
  const [open, setOpen] = useState(false);
  if (!files) return null;
  const url = (f: number) => `/api/sources/${sourceId}/media?file=${f}`;
  if (!open) {
    return (
      <div className="border-t border-outline-variant px-3 py-2">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-lg px-3 font-semibold text-secondary hover:bg-secondary/10">
          <span className="material-symbols-outlined" aria-hidden="true">
            {kind === 'audio' ? 'play_circle' : 'visibility'}
          </span>
          {kind === 'audio' ? 'Listen to the recording' : 'View the original file'}
        </button>
      </div>
    );
  }
  if (kind === 'audio') {
    return (
      <ol className="flex flex-col gap-2 border-t border-outline-variant px-3 py-2">
        {Array.from({ length: files }, (_, f) => (
          <li key={f} className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-on-surface">Part {f + 1}</span>
            <audio controls preload="none" src={url(f)} className="w-full max-w-md">
              Your browser cannot play this recording.
            </audio>
          </li>
        ))}
      </ol>
    );
  }
  if (mimeType?.startsWith('image/')) {
    // eslint-disable-next-line @next/next/no-img-element -- authenticated, uncached media
    return <img src={url(0)} alt="Original uploaded notes" className="max-h-[70vh] w-auto border-t border-outline-variant" />;
  }
  return (
    <div className="border-t border-outline-variant px-3 py-2">
      <a href={url(0)} target="_blank" rel="noopener" className="inline-flex min-h-12 items-center gap-2 rounded-lg px-3 font-semibold text-secondary hover:bg-secondary/10">
        <span className="material-symbols-outlined" aria-hidden="true">
          open_in_new
        </span>
        Open the original file
      </a>
    </div>
  );
}
