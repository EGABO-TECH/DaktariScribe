'use client';

import React, { useState } from 'react';
import {
  TranscriptWord,
  SynthesizedSentence,
  parseTranscriptWords,
  linkSynthesizedSentences,
  LOW_CONFIDENCE_THRESHOLD,
} from '@/lib/source-linking';

interface SourceLinkedReviewProps {
  rawTranscript: string;
  synthesizedNote: string;
  wordConfidences?: Record<string, number>;
}

export default function SourceLinkedReview({
  rawTranscript,
  synthesizedNote,
  wordConfidences,
}: SourceLinkedReviewProps) {
  const transcriptWords: TranscriptWord[] = React.useMemo(
    () => parseTranscriptWords(rawTranscript, wordConfidences),
    [rawTranscript, wordConfidences]
  );

  const sentences: SynthesizedSentence[] = React.useMemo(
    () => linkSynthesizedSentences(transcriptWords, synthesizedNote),
    [transcriptWords, synthesizedNote]
  );

  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null);

  const activeSentence = sentences.find((s) => s.id === activeSentenceId);
  const highlightedRange = activeSentence?.sourceSpan
    ? {
        start: activeSentence.sourceSpan.startWordIndex,
        end: activeSentence.sourceSpan.endWordIndex,
      }
    : null;

  return (
    <div className="w-full bg-white rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
      {/* Header Banner */}
      <div className="px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/20 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-headline-sm text-primary font-bold text-base flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">
              compare_arrows
            </span>
            Source-Linked Clinical Verification
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Click any sentence in the synthesized note to cross-reference with the raw audio transcript.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-on-surface-variant flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
            Low-confidence STT (&lt;70%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
            Unverified / Hallucination risk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-teal-100 border border-teal-400" />
            Active Source Span
          </span>
        </div>
      </div>

      {/* Split View Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-outline-variant/20">
        {/* Left Column: Raw Audio Transcript */}
        <div className="p-6 bg-surface-bright/50 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-secondary">mic</span>
              Raw Dictation Transcript
            </span>
            <span className="text-[11px] text-on-surface-variant/70">
              {transcriptWords.length} words
            </span>
          </div>

          <div
            id="raw-transcript-view"
            className="p-4 bg-white rounded-xl border border-outline-variant/30 text-sm leading-relaxed min-h-[220px] font-sans overflow-y-auto"
          >
            {transcriptWords.map((tw, idx) => {
              const isHighlighted =
                highlightedRange &&
                idx >= highlightedRange.start &&
                idx <= highlightedRange.end;
              const isLowConfidence =
                tw.confidence !== undefined && tw.confidence < LOW_CONFIDENCE_THRESHOLD;

              let wordClass = 'transition-colors duration-150 inline-block px-0.5 rounded ';
              if (isHighlighted) {
                wordClass += 'bg-teal-100 text-teal-950 font-semibold ring-2 ring-teal-400 ';
              } else if (isLowConfidence) {
                wordClass += 'bg-amber-100/80 text-amber-950 underline decoration-amber-500 decoration-wavy ';
              } else {
                wordClass += 'text-on-surface ';
              }

              return (
                <span
                  key={tw.id}
                  className={wordClass}
                  title={
                    isLowConfidence
                      ? `Low confidence: ${Math.round((tw.confidence ?? 0) * 100)}%`
                      : undefined
                  }
                >
                  {tw.word}{' '}
                </span>
              );
            })}
          </div>

          {activeSentence?.sourceSpan && (
            <div className="mt-3 p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-teal-600 mt-0.5">
                pin_drop
              </span>
              <div>
                <span className="font-bold">Matched Dictation Span: </span>
                <span className="italic">&ldquo;{activeSentence.sourceSpan.matchedText}&rdquo;</span>
                <div className="text-[10px] text-teal-700 mt-0.5">
                  Alignment score: {Math.round(activeSentence.sourceSpan.similarityScore * 100)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Synthesized Clinical Output */}
        <div className="p-6 bg-white flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-secondary">smart_toy</span>
              Synthesized Clinical Note
            </span>
            <span className="text-[11px] text-on-surface-variant/70">
              {sentences.length} sentences
            </span>
          </div>

          <div className="space-y-2.5 min-h-[220px]">
            {sentences.map((sentence) => {
              const isActive = sentence.id === activeSentenceId;
              const isUnsupported = !sentence.isSupported;

              let cardStyle =
                'p-3 rounded-xl border text-sm transition-all cursor-pointer text-left block w-full relative ';

              if (isActive) {
                cardStyle += 'bg-teal-50/70 border-teal-400 shadow-sm ring-1 ring-teal-400 ';
              } else if (isUnsupported) {
                cardStyle += 'bg-amber-50/50 border-amber-300 hover:bg-amber-50 ';
              } else {
                cardStyle += 'bg-white border-outline-variant/30 hover:border-secondary/50 hover:bg-surface-bright ';
              }

              return (
                <button
                  key={sentence.id}
                  type="button"
                  onClick={() => setActiveSentenceId(isActive ? null : sentence.id)}
                  className={cardStyle}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-on-surface leading-relaxed">{sentence.text}</span>
                    {isUnsupported ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <span className="material-symbols-outlined text-[12px] text-amber-700">
                          warning
                        </span>
                        Not found in dictation — verify
                      </span>
                    ) : (
                      <span className="shrink-0 text-on-surface-variant/40 group-hover:text-secondary">
                        <span className="material-symbols-outlined text-[16px]">link</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
