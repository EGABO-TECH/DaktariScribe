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
