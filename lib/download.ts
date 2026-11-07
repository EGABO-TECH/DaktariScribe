/**
 * Browser downloads for server-generated files. Fetches first, so a refusal (no pass, rate
 * limit, record not final, connection lost) comes back as a readable message instead of the
 * browser navigating to an error page. Client only.
 */

export type DownloadResult = { ok: true } | { ok: false; error: string };

/** Hands a Blob to the browser as a file download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a); // Firefox ignores clicks on detached links
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** File name from Content-Disposition (RFC 6266 filename* first, then filename). */
export function filenameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)?.[1];
  if (star) {
    try {
      return decodeURIComponent(star.trim());
    } catch {
      /* fall through */
    }
  }
  return /filename\s*=\s*"?([^";]+)"?/i.exec(header)?.[1]?.trim() || fallback;
}

/** Gateway errors and dropped connections are usually momentary on busy networks: worth one retry. */
const TRANSIENT = new Set([502, 503, 504]);

export async function downloadFile(url: string, opts: { init?: RequestInit; fallbackName: string; errorText?: string }): Promise<DownloadResult> {
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opts.init });
      if (!TRANSIENT.has(res.status) || attempt === 2) break;
    } catch {
      if (attempt === 2) return { ok: false, error: 'Connection lost. The file was not downloaded. Check your connection and try again.' };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!res) return { ok: false, error: 'Connection lost. The file was not downloaded. Check your connection and try again.' };
  if (TRANSIENT.has(res.status)) return { ok: false, error: 'The server is busy right now. Please try again in a minute.' };
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 401) return { ok: false, error: 'Your session has ended. Sign in again to download.' };
    if (res.status === 429) return { ok: false, error: 'Too many downloads in a short time. Wait a minute and try again.' };
    return { ok: false, error: data?.error ?? opts.errorText ?? 'The file could not be prepared. Please try again.' };
  }
  const blob = await res.blob();
  if (!blob.size) return { ok: false, error: opts.errorText ?? 'The file came back empty. Please try again.' };
  saveBlob(blob, filenameFrom(res.headers.get('Content-Disposition'), opts.fallbackName));
  return { ok: true };
}
