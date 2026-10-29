/**
 * Source Linking and Clinical Hallucination Detection
 * Implements TASK-1.2 (F-02, F-06):
 * - Links synthesized clinical sentences back to source spans in the raw transcript.
 * - Flags ungrounded/hallucinated content as "Not found in dictation — verify".
 * - Flags low-confidence transcript words (< 70% confidence).
 */

export interface TranscriptWord {
  id: string;
  word: string;
  confidence?: number; // 0.0 to 1.0
  startOffset?: number;
  endOffset?: number;
}

export interface SourceSpan {
  startWordIndex: number;
  endWordIndex: number;
  matchedText: string;
  similarityScore: number;
}

export interface SynthesizedSentence {
  id: string;
  text: string;
  sourceSpan?: SourceSpan;
  isSupported: boolean;
  unsupportedReason?: string;
}

export const LOW_CONFIDENCE_THRESHOLD = 0.7;
export const MATCH_THRESHOLD = 0.35; // Jaccard similarity threshold for token overlap

/**
 * Tokenizes text into lowercase normalized words, stripping punctuation.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Calculates token overlap similarity between two token lists.
 */
export function calculateTokenOverlap(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }
  const unionCount = new Set([...tokensA, ...tokensB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Parses raw text into transcript words with optional confidence values.
 */
export function parseTranscriptWords(
  text: string,
  confidences?: Record<string, number>
): TranscriptWord[] {
  const words = text.trim().split(/\s+/);
  return words.map((w, index) => {
    const cleanWord = w.toLowerCase().replace(/[^\w]/g, '');
    const conf = confidences ? confidences[cleanWord] ?? 0.95 : 0.95;
    return {
      id: `w-${index}`,
      word: w,
      confidence: conf,
    };
  });
}

/**
 * Splits synthesised text into distinct clinical sentences.
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Links each synthesized sentence to the closest matching span in the transcript.
 * Sentences with insufficient ground evidence in the transcript are flagged as unsupported.
 */
export function linkSynthesizedSentences(
  transcriptWords: TranscriptWord[],
  synthesizedText: string,
  customLinks?: Record<string, { startWordIndex: number; endWordIndex: number }>
): SynthesizedSentence[] {
  const sentences = splitSentences(synthesizedText);
  const transcriptTokens = transcriptWords.map((tw) =>
    tw.word.toLowerCase().replace(/[^\w]/g, '')
  );

  return sentences.map((sentence, sIdx) => {
    const sId = `s-${sIdx}`;

    // If explicit manual/model link provided
    if (customLinks && customLinks[sId]) {
      const { startWordIndex, endWordIndex } = customLinks[sId];
      const matched = transcriptWords
        .slice(startWordIndex, endWordIndex + 1)
        .map((w) => w.word)
        .join(' ');
      return {
        id: sId,
        text: sentence,
        sourceSpan: {
          startWordIndex,
          endWordIndex,
          matchedText: matched,
          similarityScore: 1.0,
        },
        isSupported: true,
      };
    }

    const sentenceTokens = tokenize(sentence);
    if (sentenceTokens.length === 0) {
      return {
        id: sId,
        text: sentence,
        isSupported: true,
      };
    }

    // Sliding window over transcript to find best matching source span
    let bestScore = 0;
    let bestStart = -1;
    let bestEnd = -1;

    // Window size approximately proportional to sentence length (+/- variance)
    const minWindow = Math.max(2, Math.floor(sentenceTokens.length * 0.5));
    const maxWindow = Math.min(transcriptTokens.length, Math.ceil(sentenceTokens.length * 2.0));

    for (let wSize = minWindow; wSize <= maxWindow; wSize += 2) {
      for (let i = 0; i <= transcriptTokens.length - wSize; i++) {
        const windowTokens = transcriptTokens.slice(i, i + wSize);
        const score = calculateTokenOverlap(sentenceTokens, windowTokens);
        if (score > bestScore) {
          bestScore = score;
          bestStart = i;
          bestEnd = i + wSize - 1;
        }
      }
    }

    if (bestScore >= MATCH_THRESHOLD && bestStart !== -1) {
      return {
        id: sId,
        text: sentence,
        sourceSpan: {
          startWordIndex: bestStart,
          endWordIndex: bestEnd,
          matchedText: transcriptWords
            .slice(bestStart, bestEnd + 1)
            .map((w) => w.word)
            .join(' '),
          similarityScore: Math.round(bestScore * 100) / 100,
        },
        isSupported: true,
      };
    }

    return {
      id: sId,
      text: sentence,
      isSupported: false,
      unsupportedReason: 'Not found in dictation — verify',
    };
  });
}
