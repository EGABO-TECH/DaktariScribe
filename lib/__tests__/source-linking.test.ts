import { describe, it, expect } from 'vitest';
import {
  parseTranscriptWords,
  splitSentences,
  linkSynthesizedSentences,
  LOW_CONFIDENCE_THRESHOLD,
} from '../source-linking';

describe('Source Linking & Hallucination Detection (TASK-1.2)', () => {
  it('correctly tags low confidence words in transcript', () => {
    const text = 'Patient has acute fever and cefixime allergy';
    const confidences = {
      cefixime: 0.55, // below 0.70 threshold
      acute: 0.98,
    };

    const words = parseTranscriptWords(text, confidences);
    expect(words).toHaveLength(7);
    const cefiximeWord = words.find((w) => w.word.toLowerCase() === 'cefixime');
    expect(cefiximeWord).toBeDefined();
    expect(cefiximeWord!.confidence).toBe(0.55);
    expect(cefiximeWord!.confidence! < LOW_CONFIDENCE_THRESHOLD).toBe(true);
  });

  it('splits synthesized notes into clinical sentences', () => {
    const note = 'Patient presents with mild fever. Rapid malaria test administered. Prescribed paracetamol.';
    const sentences = splitSentences(note);
    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toBe('Patient presents with mild fever.');
    expect(sentences[1]).toBe('Rapid malaria test administered.');
    expect(sentences[2]).toBe('Prescribed paracetamol.');
  });

  it('links synthesized sentence back to source span in transcript', () => {
    const transcriptText = 'The patient arrived complaining of a high fever and nausea since yesterday.';
    const transcriptWords = parseTranscriptWords(transcriptText);

    const synthesized = 'Patient reports high fever and nausea.';
    const results = linkSynthesizedSentences(transcriptWords, synthesized);

    expect(results).toHaveLength(1);
    expect(results[0].isSupported).toBe(true);
    expect(results[0].sourceSpan).toBeDefined();
    expect(results[0].sourceSpan?.matchedText).toContain('fever');
  });

  it('flags ungrounded/hallucinated sentences as "Not found in dictation — verify"', () => {
    const transcriptText = 'Patient with cough and sore throat for two days.';
    const transcriptWords = parseTranscriptWords(transcriptText);

    // Sentence 1 is grounded, Sentence 2 is completely unmentioned (hallucinated)
    const synthesized = 'Patient has cough and sore throat. Immediate appendectomy recommended.';
    const results = linkSynthesizedSentences(transcriptWords, synthesized);

    expect(results).toHaveLength(2);
    expect(results[0].isSupported).toBe(true);
    expect(results[1].isSupported).toBe(false);
    expect(results[1].unsupportedReason).toBe('Not found in dictation — verify');
  });
});
