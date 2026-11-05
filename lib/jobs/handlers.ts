/** Job handlers shared by Inngest functions and the inline (after-response) runner. */
import type { JobEvent } from './events';

export async function handle(event: JobEvent, opts: { rethrow: boolean }): Promise<void> {
  switch (event.name) {
    case 'encounter/refine.requested': {
      const { runRefinement } = await import('@/lib/pipeline/refine');
      await runRefinement(event.data.encounterId, { requestedBy: event.data.requestedBy, rethrow: opts.rethrow });
      return;
    }
    case 'source/transcribe.requested': {
      const { runTranscription } = await import('@/lib/pipeline/transcribe');
      await runTranscription(event.data.sourceId, { rethrow: opts.rethrow });
      return;
    }
    case 'source/extract.requested': {
      const { runExtraction } = await import('@/lib/pipeline/extract');
      await runExtraction(event.data.sourceId, { rethrow: opts.rethrow });
      return;
    }
  }
}

/** What to do when a job has failed for good. */
export async function onFailure(event: JobEvent): Promise<void> {
  switch (event.name) {
    case 'encounter/refine.requested': {
      const { finishWithOriginal } = await import('@/lib/pipeline/refine');
      await finishWithOriginal(event.data.encounterId);
      return;
    }
    case 'source/transcribe.requested':
    case 'source/extract.requested': {
      const { markSourceFailed } = await import('@/lib/pipeline/sources');
      await markSourceFailed(event.data.sourceId);
      return;
    }
  }
}
