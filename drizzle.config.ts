// Load .env.local for CLI use (drizzle-kit does not read it on its own).
try {
  process.loadEnvFile('.env.local');
} catch {
  /* no .env.local: rely on the environment */
}

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
});
