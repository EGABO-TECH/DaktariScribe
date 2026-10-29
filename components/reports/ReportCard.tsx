'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  EncounterStatus,
  canExportEncounter,
  transitionEncounterStatus,
  ReviewMetadata,
} from '@/lib/encounter-status';

interface ReportCardProps {
  recordId: string;
  datetime: string;
  location: string;
  workerName: string;
  transcript: string;
  initialStatus?: EncounterStatus;
  initialReviewMetadata?: ReviewMetadata;
  unconfirmedEntitiesCount?: number;
}

export default function ReportCard({
  recordId,
  datetime,
  location,
  workerName,
  transcript,
  initialStatus = 'NEEDS_REVIEW',
  initialReviewMetadata,
  unconfirmedEntitiesCount = 0,
}: ReportCardProps) {
  const [status, setStatus] = useState<EncounterStatus>(initialStatus);
  const [reviewMetadata, setReviewMetadata] = useState<ReviewMetadata | undefined>(
    initialReviewMetadata
  );
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [reviewerName, setReviewerName] = useState(workerName);
  const [reviewError, setReviewError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const isExportable = canExportEncounter(status);

  const handleApprove = () => {
    setReviewError('');
    try {
      const updated = transitionEncounterStatus(
        {
          id: recordId,
          status,
          reviewMetadata,
          unconfirmedEntitiesCount,
        },
        'REVIEWED',
        {
          reviewerId: reviewerName,
          attestation: attestationChecked,
        }
      );
      setStatus(updated.status);
      setReviewMetadata(updated.reviewMetadata);
    } catch (err: unknown) {
      const error = err as Error;
      setReviewError(error.message);
    }
  };

  const handleDownload = async () => {
    if (!isExportable) {
      setExportError('Export blocked: Human clinician review is mandatory before PDF export.');
      return;
    }

    setIsExporting(true);
    setExportError('');

    try {
      // Server-side verification gate (TASK-1.1 acceptance criteria)
      const res = await fetch(`/api/encounters/${encodeURIComponent(recordId)}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          reviewMetadata,
          unconfirmedEntitiesCount,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Server rejected export for unreviewed encounter.');
      }

      setStatus('EXPORTED');
      window.print();
    } catch (err: unknown) {
      const error = err as Error;
      setExportError(error.message || 'Failed to authorize export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow duration-200">
      {/* Card Header */}
      <div className="p-6 border-b border-outline-variant/30 bg-surface-container-lowest flex flex-col items-center justify-center relative">
        <div className="w-12 h-12 rounded-lg p-1 bg-white shadow-sm border border-outline-variant/20 mb-3 flex items-center justify-center">
          <Image
            src="/assets/DaktariScribe-Favicon.png"
            alt="DaktariScribe Logo"
            width={40}
            height={40}
            className="object-contain"
          />
        </div>
        <h3 className="font-headline-md text-primary text-[20px] font-bold tracking-tight uppercase">
          Field Report
        </h3>

        {/* Status Badge */}
        <div className="mt-2">
          {status === 'DRAFT' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              DRAFT
            </span>
          )}
          {status === 'NEEDS_REVIEW' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              NEEDS CLINICAL REVIEW
            </span>
          )}
          {status === 'REVIEWED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              CLINICIAN REVIEWED
            </span>
          )}
          {status === 'EXPORTED' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-300">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              EXPORTED & VERIFIED
            </span>
          )}
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-surface-container-low border-b border-outline-variant/30 text-center">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-variant mb-1">
            Record ID
          </span>
          <span className="font-body-sm font-medium text-primary bg-white py-1 px-2 rounded border border-outline-variant/30 break-all">
            {recordId}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-variant mb-1">
            Date / Time
          </span>
          <span className="font-body-sm font-medium text-primary bg-white py-1 px-2 rounded border border-outline-variant/30">
            {datetime}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-variant mb-1">
            Location
          </span>
          <span className="font-body-sm font-medium text-primary bg-white py-1 px-2 rounded border border-outline-variant/30">
            {location}
          </span>
        </div>
      </div>

      {/* Card Body (Transcript) */}
      <div className="p-6 flex-1 bg-white">
        <div className="mb-4">
          <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-variant mb-1 block">
            Healthcare Worker
          </span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-xs">
              {workerName.charAt(0)}
            </div>
            <span className="font-body-md font-semibold text-primary">{workerName}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-variant mb-2 block">
            Clinical Recording & Synthesis
          </span>
          <div className="relative">
            <span className="absolute top-0 left-0 text-4xl text-outline-variant/30 font-serif leading-none select-none">
              &ldquo;
            </span>
            <div className="p-4 pt-5 pb-5 bg-surface-bright border border-outline-variant/20 rounded-xl rounded-tl-none font-body-md text-on-surface leading-relaxed relative z-10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
              {transcript}
            </div>
          </div>
        </div>

        {/* Human-in-the-loop Review Gate (TASK-1.1) */}
        {!isExportable ? (
          <div className="mt-5 p-4 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider mb-2">
              <span className="material-symbols-outlined text-[16px] text-amber-600">
                gavel
              </span>
              Mandatory Clinician Review Gate
            </div>
            <p className="text-xs text-amber-800 mb-3 leading-relaxed">
              Before this note can enter official records or be exported to PDF, a licensed clinician must validate the AI transcription and synthesis.
            </p>

            {reviewError && (
              <div className="p-2 mb-3 bg-red-100 text-red-700 text-xs rounded border border-red-200">
                {reviewError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                  Reviewing Clinician Name/ID
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white rounded border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="e.g. Dr. Egabo Aaron (REG# 12345)"
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={attestationChecked}
                  onChange={(e) => setAttestationChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400 text-secondary focus:ring-secondary"
                />
                <span className="text-xs text-amber-950 font-medium select-none leading-snug">
                  I have reviewed and take clinical responsibility for this note.
                </span>
              </label>

              <button
                type="button"
                onClick={handleApprove}
                disabled={!attestationChecked}
                className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-secondary text-white hover:bg-secondary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[15px]">verified</span>
                Approve & Mark as Reviewed
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                verified
              </span>
              <div>
                <div className="font-bold">Reviewed by {reviewMetadata?.reviewedBy || workerName}</div>
                <div className="text-[10px] text-emerald-700">
                  {reviewMetadata?.reviewedAt
                    ? new Date(reviewMetadata.reviewedAt).toLocaleString()
                    : 'Validated'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider bg-emerald-100 px-2 py-0.5 rounded">
              Verified
            </span>
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="p-4 border-t border-outline-variant/30 bg-surface flex flex-col gap-3">
        {exportError && (
          <div className="p-2 bg-red-100 text-red-700 text-xs rounded border border-red-200 text-center">
            {exportError}
          </div>
        )}
        <p className="text-[9px] text-on-surface-variant leading-tight text-center px-4 opacity-80">
          This report was generated by DaktariScribe. Information is confidential and must be clinician-reviewed prior to export.
        </p>
        <button
          onClick={handleDownload}
          disabled={!isExportable || isExporting}
          className={`w-full py-2.5 rounded-lg font-body-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm ${
            isExportable
              ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed border border-gray-300'
          }`}
          title={!isExportable ? 'Clinical review required before PDF export' : 'Download PDF'}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isExportable ? 'download' : 'lock'}
          </span>
          {isExporting ? 'Verifying Export...' : isExportable ? 'Download as PDF' : 'Export Disabled (Review Required)'}
        </button>
      </div>
    </div>
  );
}
