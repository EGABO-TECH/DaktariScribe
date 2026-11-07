import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFile, filenameFrom } from '@/lib/download';

const file = (status = 200) =>
  new Response(status === 200 ? new Blob(['%PDF-1.7 content']) : JSON.stringify({ error: 'No signed-off records match.' }), {
    status,
    headers: status === 200 ? { 'Content-Disposition': 'attachment; filename="DS-1.pdf"' } : { 'Content-Type': 'application/json' },
  });

/** Minimal stand-in for the browser bits saveBlob uses (no jsdom needed). */
let saved: { href: string; download: string }[] = [];
beforeEach(() => {
  saved = [];
  vi.stubGlobal('document', {
    createElement: () => {
      const a = { href: '', download: '', rel: '', style: {} as Record<string, string>, click: () => saved.push({ href: a.href, download: a.download }), remove: () => {} };
      return a;
    },
    body: { appendChild: () => {} },
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('downloadFile', () => {
  it('saves the file under the server-given name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(file()));
    expect(await downloadFile('/api/exports/1', { fallbackName: 'x.pdf' })).toEqual({ ok: true });
    expect(saved).toEqual([{ href: 'blob:x', download: 'DS-1.pdf' }]);
  });

  it('retries once after a gateway error or dropped connection, then succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 504 })).mockResolvedValueOnce(file());
    vi.stubGlobal('fetch', fetchMock);
    expect((await downloadFile('/api/exports/1', { fallbackName: 'x.pdf' })).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(file()));
    expect((await downloadFile('/api/exports/1', { fallbackName: 'x.pdf' })).ok).toBe(true);
  }, 10_000);

  it('shows the server message for a refusal, without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(file(409));
    vi.stubGlobal('fetch', fetchMock);
    expect(await downloadFile('/api/exports', { fallbackName: 'x.pdf' })).toEqual({ ok: false, error: 'No signed-off records match.' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(saved).toEqual([]);
  });

  it('explains an ended session and rate limits plainly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    expect(await downloadFile('/a', { fallbackName: 'x' })).toMatchObject({ ok: false, error: expect.stringMatching(/sign in/i) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    expect(await downloadFile('/a', { fallbackName: 'x' })).toMatchObject({ ok: false, error: expect.stringMatching(/wait a minute/i) });
  });
});

describe('filenameFrom', () => {
  it('reads filename* and filename, with a fallback', () => {
    expect(filenameFrom(`attachment; filename*=UTF-8''Ripoti%20ya%20DS.pdf`, 'x')).toBe('Ripoti ya DS.pdf');
    expect(filenameFrom('attachment; filename="DS-1.docx"', 'x')).toBe('DS-1.docx');
    expect(filenameFrom(null, 'fallback.pdf')).toBe('fallback.pdf');
  });
});
