'use client';

/**
 * Upload (spec §5 Phase 3c): JPG, PNG, HEIC (converted to JPEG on the device), PDF, DOCX, XLSX,
 * CSV, up to 20 MB each. Images are compressed to about 1600 px on the long edge before they
 * are saved (encrypted) on the device; they upload when the draft is processed.
 */
import React, { useRef, useState } from 'react';
import { deleteAttachment, saveAttachment, type Draft } from '@/lib/offline/db';
import StatusBadge from '@/components/records/StatusBadge';

type Att = Draft['attachments'][number];
const MAX = 20 * 1024 * 1024;
const ACCEPT = '.jpg,.jpeg,.png,.heic,.heif,.webp,.pdf,.docx,.xlsx,.csv,image/*,application/pdf';

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

function typeOf(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TYPES[ext] ?? (Object.values(TYPES).includes(file.type) ? file.type : null);
}

async function compressImage(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compress'))), 'image/jpeg', 0.85));
}

function size(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function UploadPicker({ draftId, attachments, onChange }: { draftId: string; attachments: Att[]; onChange: (a: Att[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const errs: string[] = [];
    const added: Att[] = [];
    for (const file of Array.from(files)) {
      let type = typeOf(file);
      if (!type) {
        errs.push(`${file.name}: this file type is not supported.`);
        continue;
      }
      if (file.size > MAX && !type.startsWith('image/')) {
        errs.push(`${file.name}: files must be 20 MB or smaller.`);
        continue;
      }
      try {
        let blob: Blob = file;
        if (type === 'image/heic') {
          const heic2any = (await import('heic2any')).default;
          blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })) as Blob;
          type = 'image/jpeg';
        }
        if (type.startsWith('image/')) {
          blob = await compressImage(blob);
          type = 'image/jpeg';
        }
        if (blob.size > MAX) {
          errs.push(`${file.name}: still larger than 20 MB after compression.`);
          continue;
        }
        const id = crypto.randomUUID();
        await saveAttachment(draftId, id, blob);
        added.push({ id, name: file.name.replace(/\.(heic|heif)$/i, '.jpg'), mimeType: type, bytes: blob.size });
      } catch {
        errs.push(`${file.name}: could not be read on this device.`);
      }
    }
    setErrors(errs);
    if (added.length) onChange([...attachments, ...added]);
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  const remove = async (a: Att) => {
    await deleteAttachment(a.id);
    onChange(attachments.filter((x) => x.id !== a.id));
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline p-6 text-center hover:bg-surface-container-low">
        <span className="material-symbols-outlined text-[32px] text-secondary" aria-hidden="true">
          upload_file
        </span>
        <span className="font-semibold text-on-surface">{busy ? 'Saving on this device…' : 'Take a photo or choose files'}</span>
        <span className="text-[13px] text-on-surface-variant">Photos of handwritten notes, PDF, Word, Excel or CSV · up to 20 MB each</span>
        <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => void add(e.target.files)} disabled={busy} />
      </label>
      {errors.length > 0 && (
        <ul role="alert" className="rounded-lg border border-error bg-error-container p-3 text-[14px] text-on-error-container">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {attachments.length > 0 && (
        <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant" aria-label="Attached files">
          {attachments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-body-md text-on-surface">
                {a.name} <span className="text-on-surface-variant">· {size(a.bytes)}</span>
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge status="saved_on_device" />
                <button type="button" onClick={() => remove(a)} className="min-h-12 rounded-lg px-3 font-semibold text-error hover:bg-error/10" aria-label={`Remove ${a.name}`}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
