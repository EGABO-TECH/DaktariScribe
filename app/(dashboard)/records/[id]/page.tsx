import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import RecordBody from '@/components/records/RecordBody';
import SignOffPanel from '@/components/records/SignOffPanel';
import StatusBadge from '@/components/records/StatusBadge';
import { isDatabaseConfigured } from '@/db';
import { requireAuth } from '@/lib/auth';
import { canEdit, canExport } from '@/lib/encounter-status';
import { logger } from '@/lib/logger';
import { languageName } from '@/lib/records/languages';
import { getRecordDetail, NotFoundError, SIGNOFF_STATEMENT, type RecordDetail } from '@/lib/records/service';

export const metadata = { title: 'Record — DaktariScribe' };

const dateFmt = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const dateTimeFmt = (d: Date) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala' }).format(d);

const STEPS = [
  { key: 'captured', label: 'Captured' },
  { key: 'in_review', label: 'Ready for review' },
  { key: 'final', label: 'Signed off' },
] as const;

function Progress({ status }: { status: RecordDetail['status'] }) {
  const reached = status === 'final' ? 3 : status === 'in_review' ? 2 : 1;
  return (
    <ol aria-label="Record progress" className="flex flex-wrap items-center gap-2 text-[13px]">
      {STEPS.map((s, i) => {
        const done = i < reached;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${
                done ? 'border-secondary bg-success-container text-on-success-container' : 'border-outline-variant text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                {done ? 'check_circle' : 'radio_button_unchecked'}
              </span>
              {s.label}
              <span className="sr-only">{done ? ' (done)' : ' (pending)'}</span>
            </span>
            {i < STEPS.length - 1 && <span aria-hidden="true" className="h-px w-4 bg-outline-variant" />}
          </li>
        );
      })}
    </ol>
  );
}

export default async function RecordPage({ params }: PageProps<'/records/[id]'>) {
  const { id } = await params;
  const ctx = await requireAuth();

  if (!isDatabaseConfigured()) {
    return (
      <PageShell title="Record">
        <ServiceNotice title="Records service unavailable">This record can&apos;t be shown right now.</ServiceNotice>
      </PageShell>
    );
  }

  let record: RecordDetail;
  try {
    record = await getRecordDetail(ctx, decodeURIComponent(id), { audit: true });
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    logger.error('record.load_failed', { encounterId: id, err });
    return (
      <PageShell title="Record">
        <ServiceNotice title="This record could not be loaded">Check your connection and reload the page.</ServiceNotice>
      </PageShell>
    );
  }

  const isAuthor = record.workerId === ctx.userId;
  const v = record.currentVersion;
  const meta: [string, string][] = [
    ['Encounter date', dateFmt(record.encounterDate)],
    ['Site', record.site],
    ['Template', record.template.name],
    ['Author', record.workerName],
    ['Interview language', languageName(record.interviewLanguage)],
    ['Respondent ref.', record.respondentRef || 'Not recorded'],
    ['Consent obtained', record.consentObtained ? 'Yes' : 'No'],
    ['Captured', dateTimeFmt(record.createdAt)],
  ];

  return (
    <PageShell
      title="Record"
      width="max-w-5xl"
      actions={
        <Link href="/saved-records" className="inline-flex min-h-12 items-center gap-1 rounded-lg px-3 font-semibold text-secondary hover:bg-secondary/10">
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_back
          </span>
          Saved records
        </Link>
      }
    >
      {/* Header */}
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant">Record ID</p>
            <p className="font-label-status text-[16px] font-semibold text-primary break-all">{record.id}</p>
          </div>
          <StatusBadge status={record.status} />
        </div>
        <div className="mt-4">
          <Progress status={record.status} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {meta.map(([k, val]) => (
            <div key={k}>
              <dt className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant">{k}</dt>
              <dd className="text-body-md text-on-surface">{val}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Current version */}
      {v ? (
        <RecordBody
          recordId={record.id}
          versionId={v.id}
          versionNo={v.versionNo}
          content={v.content}
          definition={record.template.definition}
          editable={canEdit(record.status, isAuthor)}
        />
      ) : (
        <ServiceNotice title="No version yet">This record is still being prepared.</ServiceNotice>
      )}

      {/* Sign-off / export */}
      <section aria-labelledby="signoff-h" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
        <h2 id="signoff-h" className="mb-3 font-headline-sm text-headline-sm text-primary">
          {record.status === 'final' ? 'Signed off' : 'Review and sign off'}
        </h2>
        {record.status === 'final' && record.signoff ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-lg border border-secondary bg-success-container p-3 text-on-success-container">
              <span className="material-symbols-outlined" aria-hidden="true">
                verified
              </span>
              <div>
                <p className="font-semibold">
                  Signed off by {record.signoff.signerName} on {dateTimeFmt(record.signoff.signedAt)}
                </p>
                <p className="text-[14px]">{record.signoff.statement}</p>
              </div>
            </div>
            {canExport(record.status) && (
              <a
                href={`/api/exports/${encodeURIComponent(record.id)}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-lg bg-primary px-6 font-semibold text-on-primary hover:bg-primary/90"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  picture_as_pdf
                </span>
                Download PDF report
              </a>
            )}
          </div>
        ) : v ? (
          <SignOffPanel recordId={record.id} versionId={v.id} versionNo={v.versionNo} status={record.status} isAuthor={isAuthor} statement={SIGNOFF_STATEMENT} />
        ) : null}
      </section>

      {/* Original source(s) */}
      <section aria-labelledby="sources-h" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
        <h2 id="sources-h" className="mb-1 font-headline-sm text-headline-sm text-primary">
          Original notes
        </h2>
        <p className="mb-3 text-[13px] text-on-surface-variant">Stored exactly as captured. Originals are never changed.</p>
        {record.sources.map((s) => (
          <details key={s.id} className="rounded-lg border border-outline-variant" open={record.sources.length === 1}>
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-3 font-semibold text-on-surface">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {s.kind === 'audio' ? 'mic' : s.kind === 'upload' ? 'upload_file' : 'keyboard'}
              </span>
              {s.kind === 'text' ? 'Typed note' : s.kind === 'audio' ? 'Recording' : 'Uploaded file'}
              <span className="font-normal text-on-surface-variant">· {dateTimeFmt(s.createdAt)}</span>
            </summary>
            <pre className="whitespace-pre-wrap border-t border-outline-variant bg-surface-container-low p-3 font-body-md text-body-md text-on-surface">{s.rawText}</pre>
          </details>
        ))}
      </section>

      {/* History */}
      <section aria-labelledby="history-h" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
        <h2 id="history-h" className="mb-3 font-headline-sm text-headline-sm text-primary">
          History
        </h2>
        <ol className="flex flex-col gap-2">
          {record.signoff && (
            <li className="flex flex-wrap items-center gap-2 text-body-md text-on-surface">
              <span className="material-symbols-outlined text-[20px] text-secondary" aria-hidden="true">
                verified
              </span>
              Signed off by {record.signoff.signerName}
              <span className="text-on-surface-variant">· {dateTimeFmt(record.signoff.signedAt)}</span>
            </li>
          )}
          {record.versions.map((ver) => (
            <li key={ver.id} className="flex flex-wrap items-center gap-2 text-body-md text-on-surface">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">
                history
              </span>
              Version {ver.versionNo}
              {ver.versionNo === 1 ? ' created from the original note' : ` edited by ${ver.createdBy === record.workerId ? record.workerName : 'a reviewer'}`}
              <span className="text-on-surface-variant">· {dateTimeFmt(ver.createdAt)}</span>
              {ver.id === v?.id && <span className="rounded bg-surface-container-high px-1.5 text-[12px] font-semibold">current</span>}
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}
