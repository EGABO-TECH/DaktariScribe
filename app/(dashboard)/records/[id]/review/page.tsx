import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageShell from '@/components/layout/PageShell';
import ServiceNotice from '@/components/layout/ServiceNotice';
import ReviewWorkspace, { type ReviewSource } from '@/components/review/ReviewWorkspace';
import StatusBadge from '@/components/records/StatusBadge';
import { isDatabaseConfigured } from '@/db';
import { requireAuth } from '@/lib/auth';
import { canEdit } from '@/lib/encounter-status';
import { logger } from '@/lib/logger';
import { getRecordDetail, NotFoundError, type RecordDetail } from '@/lib/records/service';

export const metadata = { title: 'Review — DaktariScribe' };

export default async function ReviewPage({ params }: PageProps<'/records/[id]/review'>) {
  const { id } = await params;
  const ctx = await requireAuth();
  if (!isDatabaseConfigured()) {
    return (
      <PageShell title="Review">
        <ServiceNotice title="Records service unavailable">This record can&apos;t be reviewed right now.</ServiceNotice>
      </PageShell>
    );
  }
  let record: RecordDetail;
  try {
    record = await getRecordDetail(ctx, decodeURIComponent(id), { audit: true });
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    logger.error('review.load_failed', { encounterId: id, err });
    return (
      <PageShell title="Review">
        <ServiceNotice title="This record could not be loaded">Check your connection and reload the page.</ServiceNotice>
      </PageShell>
    );
  }

  const v = record.currentVersion;
  const sources: ReviewSource[] = record.sources.map((s) => ({
    id: s.id,
    kind: s.kind,
    rawText: s.rawText,
    status: s.status,
    error: s.error,
    segments: s.kind === 'audio' ? (s.segments as ReviewSource['segments']) : null,
    fileName: (s.meta?.fileName as string | undefined) ?? null,
  }));
  const organised = v?.createdBy === 'ai' || Boolean(v && v.versionNo > 1 && record.versions.some((x) => x.createdBy === 'ai'));

  return (
    <PageShell
      title="Review"
      width="max-w-[1600px]"
      description={`${record.id} · ${record.site}`}
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge status={record.status} />
          <Link href={`/records/${encodeURIComponent(record.id)}`} className="inline-flex min-h-12 items-center gap-1 rounded-lg px-3 font-semibold text-secondary hover:bg-secondary/10">
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_back
            </span>
            Record
          </Link>
        </div>
      }
    >
      {!v ? (
        <ServiceNotice title="Still processing">The draft will appear here when it is ready.</ServiceNotice>
      ) : (
        <ReviewWorkspace
          key={v.id}
          recordId={record.id}
          versionId={v.id}
          content={v.content}
          definition={record.template.definition}
          sources={sources}
          editable={canEdit(record.status, record.workerId === ctx.userId)}
          organised={organised}
          localLanguage={record.interviewLanguage !== 'eng'}
        />
      )}
    </PageShell>
  );
}
