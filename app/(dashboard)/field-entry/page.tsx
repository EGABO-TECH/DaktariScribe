'use client';

import React, { useState } from 'react';
import SourceLinkedReview from '@/components/encounters/SourceLinkedReview';

export default function FieldEntryPage() {
  const [activeTab, setActiveTab] = useState<'dictation' | 'review'>('dictation');
  
  // Sample verification data for demonstration and interactive testing
  const sampleTranscript =
    'Patient is a 34-year-old female presenting at Camp Alpha with severe headache, fever, and generalized chills since yesterday. She denies nausea or vomiting. Blood pressure is 120/80 mmHg, temperature 38.5 C. Administered rapid malaria test which returned positive for Plasmodium falciparum. Prescribed Artemether-lumefantrine 80/480 mg orally twice daily for 3 days. Patient informed about danger signs.';
  
  const sampleSynthesized =
    'Patient is a 34-year-old female presenting with severe headache and fever of 38.5 C. Denies nausea and vomiting. Rapid diagnostic test confirms Plasmodium falciparum malaria. Prescribed Artemether-lumefantrine 80/480 mg orally for 3 days. Patient advised to commence physiotherapy immediately.';

  const sampleConfidences: Record<string, number> = {
    artemether: 0.62, // Flagged low-confidence word
    falciparum: 0.68, // Flagged low-confidence word
  };

  return (
    <main className="flex-1 overflow-y-auto p-margin-desktop pb-24 lg:pb-margin-desktop">
      <div className="max-w-7xl mx-auto flex flex-col gap-gutter">
        {/* Top Control Bar */}
        <div className="flex flex-wrap justify-between items-center gap-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30">
          <div className="flex bg-surface-container-low p-1 rounded-lg border border-outline-variant/30">
            <button
              onClick={() => setActiveTab('dictation')}
              className={`px-4 py-1.5 rounded-md font-medium text-body-md transition-all shadow-sm ${
                activeTab === 'dictation'
                  ? 'bg-secondary text-on-secondary'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Live Dictation
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-4 py-1.5 rounded-md font-medium text-body-md transition-all flex items-center gap-1.5 ${
                activeTab === 'review'
                  ? 'bg-secondary text-on-secondary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
              Source-Linked Review
            </button>
          </div>

          <div className="flex items-center gap-2 font-label-status text-secondary bg-secondary-container/20 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(0,107,92,0.3)]">
            <span className="w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
            ACTIVE SESSION
          </div>
        </div>

        {activeTab === 'dictation' ? (
          /* Main Dictation Interface */
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg flex flex-col relative dictating ambient-shadow min-h-[calc(100vh-240px)]">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs uppercase font-bold tracking-wider text-on-surface-variant">
                Audio Input Stream
              </span>
              <button
                onClick={() => setActiveTab('review')}
                className="text-xs text-secondary font-bold flex items-center gap-1 hover:underline"
              >
                Review organised draft &rarr;
              </button>
            </div>

            <div id="unified-card-body" className="flex-1 flex flex-col">
              <div
                className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl flex flex-col mb-6 relative overflow-hidden h-full min-h-[200px]"
                style={{
                  backgroundImage:
                    'radial-gradient(rgba(0, 107, 92, 0.063) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              >
                <div className="flex-1 flex items-center justify-center gap-1.5 px-8">
                  <div className="flex items-center gap-1.5 h-32">
                    <div className="w-1.5 bg-secondary rounded-full h-8 animate-[pulse_1.2s_ease-in-out_infinite]"></div>
                    <div className="w-1.5 bg-secondary/60 rounded-full h-16 animate-[pulse_1.5s_ease-in-out_infinite_0.1s]"></div>
                    <div className="w-1.5 bg-secondary/80 rounded-full h-24 animate-[pulse_1s_ease-in-out_infinite_0.2s]"></div>
                    <div className="w-1.5 bg-secondary rounded-full h-32 animate-[pulse_0.8s_ease-in-out_infinite_0.3s]"></div>
                    <div className="w-1.5 bg-secondary/80 rounded-full h-20 animate-[pulse_1.3s_ease-in-out_infinite_0.4s]"></div>
                    <div className="w-1.5 bg-secondary/60 rounded-full h-12 animate-[pulse_1.1s_ease-in-out_infinite_0.5s]"></div>
                    <div className="w-1.5 bg-secondary rounded-full h-28 animate-[pulse_0.9s_ease-in-out_infinite_0.6s]"></div>
                    <div className="w-1.5 bg-secondary/70 rounded-full h-14 animate-[pulse_1.4s_ease-in-out_infinite_0.7s]"></div>
                    <div className="w-1.5 bg-secondary rounded-full h-22 animate-[pulse_1.2s_ease-in-out_infinite_0.8s]"></div>
                    <div className="w-1.5 bg-secondary/50 rounded-full h-10 animate-[pulse_1.6s_ease-in-out_infinite_0.9s]"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex gap-3">
                  <button className="h-12 px-6 bg-secondary text-on-secondary rounded-lg font-headline-sm flex items-center gap-2 hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20 cursor-pointer">
                    <span className="material-symbols-outlined icon-fill">mic</span>
                    Start
                  </button>
                  <button className="h-12 px-6 border-2 border-secondary text-secondary rounded-lg font-headline-sm flex items-center gap-2 hover:bg-secondary/5 transition-all cursor-pointer">
                    <span className="material-symbols-outlined">pause</span>
                    Pause
                  </button>
                  <button className="h-12 px-6 bg-error text-on-error rounded-lg font-headline-sm flex items-center gap-2 hover:bg-error/90 transition-all cursor-pointer">
                    <span className="material-symbols-outlined icon-fill">stop</span>
                    Stop
                  </button>
                </div>

                <button
                  onClick={() => setActiveTab('review')}
                  className="h-12 px-8 bg-primary text-on-primary rounded-lg font-headline-sm flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg cursor-pointer"
                >
                  <span className="material-symbols-outlined">compare_arrows</span>
                  Proceed to Verification
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Source Linked Clinical Verification View (TASK-1.2) */
          <SourceLinkedReview
            rawTranscript={sampleTranscript}
            synthesizedNote={sampleSynthesized}
            wordConfidences={sampleConfidences}
          />
        )}
      </div>
    </main>
  );
}
