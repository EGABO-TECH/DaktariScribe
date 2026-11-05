import Link from 'next/link';

export const metadata = { title: 'Offline — DaktariScribe' };

/** Shown by the service worker for pages that are never stored on the device (they hold patient data). */
export default function OfflinePage() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-background p-6 text-on-background">
      <div className="max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6">
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant" aria-hidden="true">
          wifi_off
        </span>
        <h1 className="mt-2 font-headline-sm text-headline-sm text-primary">You are offline</h1>
        <p className="mt-2 text-body-md text-on-surface">
          Saved records open when you are back online. You can keep capturing encounters: notes, recordings and files are saved on this device and upload automatically.
        </p>
        <Link href="/field-entry" className="mt-4 inline-flex min-h-12 items-center rounded-lg bg-primary px-5 font-semibold text-on-primary">
          Go to Field Entry
        </Link>
      </div>
    </main>
  );
}
