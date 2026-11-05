'use client';

/**
 * Voice recording (spec §5 Phase 3a). Browser only.
 * - getUserMedia with echo cancellation, noise suppression, AGC, mono, 16 kHz.
 * - MediaRecorder with Opus (audio/webm;codecs=opus), falling back to audio/mp4 (iOS Safari).
 * - The recorder restarts every 5 minutes so each segment is a self-contained file; within a
 *   segment a 30 s chunk is written to encrypted device storage, so nothing is lost if the
 *   page closes.
 * - A real level meter (AnalyserNode) with warnings for >10 s of silence and for clipping.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { deleteSegment, saveAudioChunk, type Draft } from '@/lib/offline/db';
import StatusBadge from '@/components/records/StatusBadge';

const SEGMENT_MS = 5 * 60_000;
const TIMESLICE_MS = 30_000;
const SILENCE_MS = 10_000;

type Segment = Draft['segments'][number];
type State = 'idle' | 'recording' | 'paused';

function pickMimeType(): string {
  const options = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  return options.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? '';
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function Recorder({
  draftId,
  segments,
  onSegmentsChange,
  disabled,
}: {
  draftId: string;
  segments: Segment[];
  onSegmentsChange: (s: Segment[]) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<State>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [warning, setWarning] = useState<'silence' | 'clipping' | null>(null);
  const [error, setError] = useState('');

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number>(0);
  const segIndex = useRef(segments.length ? Math.max(...segments.map((s) => s.index)) + 1 : 0);
  const seq = useRef(0);
  const segStart = useRef(0);
  const segActiveMs = useRef(0);
  const totalBefore = useRef(segments.reduce((n, s) => n + s.durationSec * 1000, 0));
  const lastSound = useRef(Date.now());
  const segBytes = useRef(0);
  const segTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentsRef = useRef(segments);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);
  const mime = useRef('');
  const stopping = useRef<'segment' | 'stop' | null>(null);

  const meter = useCallback(() => {
    const ctx = audioCtx.current;
    const s = stream.current;
    if (!ctx || !s) return;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(s).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      let sum = 0;
      for (const v of buf) {
        peak = Math.max(peak, Math.abs(v));
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      setLevel(Math.min(1, rms * 6));
      const now = Date.now();
      if (rms > 0.01) lastSound.current = now;
      if (recorder.current?.state === 'recording') {
        if (peak >= 0.99) setWarning('clipping');
        else if (now - lastSound.current > SILENCE_MS) setWarning('silence');
        else setWarning(null);
        setElapsed(totalBefore.current + segActiveMs.current + (now - segStart.current));
      }
      raf.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const startSegment = useCallback(() => {
    const s = stream.current;
    if (!s) return;
    const rec = new MediaRecorder(s, mime.current ? { mimeType: mime.current, audioBitsPerSecond: 32_000 } : undefined);
    recorder.current = rec;
    seq.current = 0;
    segBytes.current = 0;
    segActiveMs.current = 0;
    segStart.current = Date.now();
    const index = segIndex.current;
    rec.ondataavailable = async (e) => {
      if (!e.data.size) return;
      segBytes.current += e.data.size;
      try {
        await saveAudioChunk(draftId, index, seq.current++, e.data);
      } catch {
        setError('Could not save audio on this device. Check free storage space.');
      }
    };
    rec.onstop = () => {
      const durationSec = Math.round((segActiveMs.current + (rec.state === 'inactive' && stopping.current ? 0 : 0)) / 1000);
      const seg: Segment = { index, mimeType: rec.mimeType || mime.current || 'audio/webm', durationSec, bytes: segBytes.current, savedAt: Date.now() };
      totalBefore.current += segActiveMs.current;
      const next = [...segmentsRef.current, seg];
      segmentsRef.current = next;
      onSegmentsChange(next);
      segIndex.current++;
      if (stopping.current === 'segment') {
        stopping.current = null;
        startSegment();
      }
    };
    rec.start(TIMESLICE_MS);
    segTimer.current = setTimeout(() => {
      if (rec.state !== 'inactive') {
        segActiveMs.current += Date.now() - segStart.current;
        stopping.current = 'segment';
        rec.stop();
      }
    }, SEGMENT_MS);
  }, [draftId, onSegmentsChange]);

  const start = async () => {
    setError('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 16000 },
      });
    } catch {
      setError('Microphone access was blocked. Allow the microphone for this site and try again.');
      return;
    }
    mime.current = pickMimeType();
    audioCtx.current = new AudioContext();
    lastSound.current = Date.now();
    startSegment();
    meter();
    setState('recording');
  };

  const pause = () => {
    const rec = recorder.current;
    if (rec?.state === 'recording') {
      rec.pause();
      segActiveMs.current += Date.now() - segStart.current;
      if (segTimer.current) clearTimeout(segTimer.current);
      setState('paused');
      setWarning(null);
    }
  };

  const resume = () => {
    const rec = recorder.current;
    if (rec?.state === 'paused') {
      rec.resume();
      segStart.current = Date.now();
      lastSound.current = Date.now();
      segTimer.current = setTimeout(() => {
        if (rec.state !== 'inactive') {
          segActiveMs.current += Date.now() - segStart.current;
          stopping.current = 'segment';
          rec.stop();
        }
      }, Math.max(1000, SEGMENT_MS - segActiveMs.current));
      setState('recording');
    }
  };

  const cleanup = () => {
    cancelAnimationFrame(raf.current);
    if (segTimer.current) clearTimeout(segTimer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close();
    audioCtx.current = null;
  };

  const stop = () => {
    const rec = recorder.current;
    if (rec && rec.state !== 'inactive') {
      if (rec.state === 'recording') segActiveMs.current += Date.now() - segStart.current;
      stopping.current = 'stop';
      rec.stop();
    }
    cleanup();
    setState('idle');
    setLevel(0);
    setWarning(null);
  };

  useEffect(() => () => cleanup(), []);

  const removeSegment = async (seg: Segment) => {
    if (!window.confirm('Delete this part of the recording from this device?')) return;
    await deleteSegment(draftId, seg.index);
    onSegmentsChange(segments.filter((s) => s.index !== seg.index));
  };

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices;
  const totalSec = segments.reduce((n, s) => n + s.durationSec, 0);

  return (
    <div className="flex flex-col gap-4">
      {!supported && <p className="rounded-lg border border-flag bg-flag-container p-3 text-on-flag-container">This browser cannot record audio. Use Chrome on Android or Safari on iPhone.</p>}

      <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-label-status text-[28px] font-semibold text-on-surface" aria-live="off">
            {fmt(state === 'idle' ? totalSec * 1000 : elapsed)}
          </p>
          {state === 'recording' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-error-container px-3 py-1 text-[13px] font-semibold text-on-error-container">
              <span className="h-2.5 w-2.5 rounded-full bg-error" aria-hidden="true" /> Recording
            </span>
          )}
          {state === 'paused' && <span className="rounded-full bg-surface-container-high px-3 py-1 text-[13px] font-semibold text-on-surface">Paused</span>}
        </div>
        {/* Level meter */}
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-surface-container-high" role="meter" aria-label="Input level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
          <div className={`h-full rounded-full ${level > 0.9 ? 'bg-error' : 'bg-secondary'}`} style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
        <div className="mt-2 min-h-6 text-[14px] font-semibold" aria-live="polite">
          {warning === 'silence' && <span className="text-on-flag-container">No sound for 10 seconds. Check the microphone is not covered.</span>}
          {warning === 'clipping' && <span className="text-error">Too loud. Move the phone a little further away.</span>}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-[14px] text-on-error-container">
          {error}
        </p>
      )}

      {/* Large, thumb-reachable controls */}
      <div className="grid grid-cols-3 gap-3">
        {state === 'idle' ? (
          <button
            type="button"
            onClick={start}
            disabled={disabled || !supported}
            className="col-span-3 inline-flex min-h-16 items-center justify-center gap-2 rounded-xl bg-secondary text-[18px] font-semibold text-on-secondary hover:bg-secondary/90 disabled:opacity-60"
          >
            <span className="material-symbols-outlined icon-fill text-[28px]" aria-hidden="true">
              mic
            </span>
            {segments.length ? 'Continue recording' : 'Start recording'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={state === 'recording' ? pause : resume}
              className="col-span-2 inline-flex min-h-16 items-center justify-center gap-2 rounded-xl border-2 border-secondary text-[18px] font-semibold text-secondary hover:bg-secondary/10"
            >
              <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
                {state === 'recording' ? 'pause' : 'play_arrow'}
              </span>
              {state === 'recording' ? 'Pause' : 'Resume'}
            </button>
            <button type="button" onClick={stop} className="inline-flex min-h-16 items-center justify-center gap-2 rounded-xl bg-error text-[18px] font-semibold text-on-error hover:bg-error/90">
              <span className="material-symbols-outlined icon-fill text-[28px]" aria-hidden="true">
                stop
              </span>
              Stop
            </button>
          </>
        )}
      </div>

      {segments.length > 0 && (
        <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant" aria-label="Recorded parts">
          {segments.map((s, i) => (
            <li key={s.index} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="text-body-md text-on-surface">
                Part {i + 1} · {fmt(s.durationSec * 1000)}
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge status="saved_on_device" />
                {state === 'idle' && (
                  <button type="button" onClick={() => removeSegment(s)} className="min-h-12 rounded-lg px-3 font-semibold text-error hover:bg-error/10" aria-label={`Delete part ${i + 1}`}>
                    Delete
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
