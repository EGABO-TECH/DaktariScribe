/** A transcript segment. Times are seconds from the start of the whole recording. */
export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
  /** Words below the confidence threshold (AssemblyAI only). */
  lowConfidence?: string[];
  engine: 'assemblyai' | 'sunbird';
  file: number;
  /** Seconds from the start of the whole recording at which this segment's file begins. */
  fileOffset?: number;
  /** Character range of this segment in source.rawText (set when the transcript text is built). */
  charStart?: number;
  charEnd?: number;
};

export type SegmentTranscript = {
  segments: Omit<TranscriptSegment, 'file'>[];
  durationSec: number;
  engine: 'assemblyai' | 'sunbird';
};

export interface SttEngine {
  readonly name: 'assemblyai' | 'sunbird';
  configured(): boolean;
  supports(language: string): boolean;
  transcribe(audio: Buffer, mimeType: string, language: string): Promise<SegmentTranscript>;
}

export class AudioTrimmedError extends Error {
  constructor() {
    super('The speech service trimmed this recording; it must be re-split into shorter segments.');
    this.name = 'AudioTrimmedError';
  }
}

export const LOW_CONFIDENCE = 0.6;
