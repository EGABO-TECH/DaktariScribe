import { serve } from 'inngest/next';
import { functions, inngest } from '@/lib/jobs/inngest';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Inngest verifies requests with INNGEST_SIGNING_KEY in production.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
