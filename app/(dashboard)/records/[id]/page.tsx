import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import RecordBody from '@/components/records/RecordBody';
import SignOffPanel from '@/components/records/SignOffPanel';
import StatusBadge from '@/components/records/StatusBadge';
import ProcessingProgress from '@/components/records/ProcessingProgress';
import SourceMedia from '@/components/records/SourceMedia';
import ExportPanel from '@/components/exports/ExportPanel';
import { Alert, btn, Card, Icon } from '@/components/ui/kit';
import { isDatabaseConfigured } from '@/db';
import { requireAuth } from '@/lib/auth';
import { canEdit, canExport } from '@/lib/encounter-status';
import { logger } from '@/lib/logger';
import { languageName } from '@/lib/records/languages';
import { countBlockingFlags } from '@/lib/records/refined-record';
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

function sourceLabel(s: RecordDetail['sources'][number]) {
  if (s.kind === 'text') return 'Typed note';
  if (s.kind === 'audio') return 'Recording (transcript)';
  return (s.meta?.fileName as string | undefined) ?? 'Uploaded file';
}

function initialStep(record: RecordDetail) {
  if (record.sources.some((s) => s.status === 'pending_upload')) return 'uploading' as const;
  if (record.sources.some((s) => s.status === 'pending' || s.status === 'processing')) return 'transcribing' as const;
  return 'organising' as const;
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
  const blockingFlags = v ? countBlockingFlags(v.content) : 0;
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
      title={record.template.name}
      width="max-w-5xl"
      back={{ href: '/saved-records', label: 'Saved records' }}
      description={`${record.site} · ${dateFmt(record.encounterDate)}`}
      actions={
        v && record.status === 'in_review' ? (
          <Link href={`/records/${encodeURIComponent(record.id)}/review`} className={btn.primary}>
            <Icon name="rate_review" />
            Open review
          </Link>
        ) : undefined
      }
    >
      {/* Summary */}
      <Card padded={false}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant bg-surface-container-low/60 px-4 py-4 md:px-6">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant">Record ID</p>
            <p className="font-label-status text-[16px] font-semibold text-primary break-all">{record.id}</p>
          </div>
          <StatusBadge status={record.status} />
        </div>
        <div className="flex flex-col gap-5 p-4 md:p-6">
          <Progress status={record.status} />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {meta.map(([k, val]) => (
              <div key={k}>
                <dt className="text-[12px] font-semibold uppercase tracking-wider text-on-surface-variant">{k}</dt>
                <dd className="mt-0.5 text-body-md font-medium text-on-surface">{val}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      {record.status === 'processing' && (
        <Card id="progress" icon="hourglass_top" title="Preparing the draft" description="This usually takes under a minute. You can leave this page; the record keeps processing.">
          <ProcessingProgress recordId={record.id} initialStep={initialStep(record)} />
        </Card>
      )}

      {v && record.status === 'in_review' && (
        <Alert
          tone={blockingFlags ? 'warning' : 'success'}
          title={blockingFlags ? `${blockingFlags} item(s) need checking before sign-off` : 'Ready for review'}
          action={
            <Link href={`/records/${encodeURIComponent(record.id)}/review`} className={btn.primary}>
              <Icon name="rate_review" />
              Open review
            </Link>
          }
        >
          Compare the draft with the original notes, fix anything that is wrong, then sign off.
        </Alert>
      )}

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
      ) : record.status === 'processing' ? null : (
        <ServiceNotice title="No version yet">This record is still being prepared.</ServiceNotice>
      )}

      {/* Sign-off / export */}
      {record.status !== 'processing' && (
        <Card id="signoff" icon={record.status === 'final' ? 'verified' : 'draw'} title={record.status === 'final' ? 'Signed off' : 'Review and sign off'}>
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
              {canExport(record.status) && <ExportPanel scope={{ encounterIds: [record.id] }} single />}
            </div>
          ) : v ? (
            <SignOffPanel
              recordId={record.id}
              versionId={v.id}
              versionNo={v.versionNo}
              status={record.status}
              isAuthor={isAuthor}
              statement={SIGNOFF_STATEMENT}
              blockingFlags={blockingFlags}
            />
          ) : null}
        </Card>
      )}

      {/* Original source(s) */}
      <Card id="sources" icon="inventory_2" title="Original notes" description="Stored exactly as captured. Originals are never changed.">
        <div className="flex flex-col gap-2">
          {record.sources.map((s) => (
            <details key={s.id} className="rounded-lg border border-outline-variant" open={record.sources.length === 1}>
              <summary className="flex min-h-12 cursor-pointer flex-wrap items-center gap-2 px-3 font-semibold text-on-surface">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  {s.kind === 'audio' ? 'mic' : s.kind === 'upload' ? 'upload_file' : 'keyboard'}
                </span>
                {sourceLabel(s)}
                <span className="font-normal text-on-surface-variant">· {dateTimeFmt(s.createdAt)}</span>
                {s.status === 'failed' && <span className="font-normal text-error">· {s.error}</span>}
              </summary>
              {s.kind !== 'text' && <SourceMedia sourceId={s.id} kind={s.kind} files={s.fileCount} mimeType={s.mimeType} />}
              <pre className="whitespace-pre-wrap border-t border-outline-variant bg-surface-container-low p-3 font-body-md text-body-md text-on-surface">
                {s.rawText ?? (s.status === 'ready' ? '' : 'Not available yet.')}
              </pre>
            </details>
          ))}
        </div>
      </Card>

      {/* History */}
      <Card id="history" icon="history" title="History">
        <ol className="flex flex-col gap-3 border-l-2 border-outline-variant pl-4">
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
              {ver.createdBy === 'ai'
                ? ' organised from the original notes'
                : ver.createdBy === record.workerId
                  ? ver.versionNo === 1
                    ? ' from the original notes'
                    : ` reviewed by ${record.workerName}`
                  : ' prepared from the original notes'}
              <span className="text-on-surface-variant">· {dateTimeFmt(ver.createdAt)}</span>
              {ver.id === v?.id && <span className="rounded bg-surface-container-high px-1.5 text-[12px] font-semibold">current</span>}
            </li>
          ))}
        </ol>
      </Card>
    </PageShell>
  );
}
