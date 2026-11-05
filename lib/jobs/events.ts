/** Background job events (spec §3 Inngest). Payloads carry IDs only, never patient content. */
export type JobEvent =
  | { name: 'encounter/refine.requested'; data: { encounterId: string; requestedBy?: string } }
  | { name: 'source/transcribe.requested'; data: { sourceId: string } }
  | { name: 'source/extract.requested'; data: { sourceId: string } };

export type JobName = JobEvent['name'];
