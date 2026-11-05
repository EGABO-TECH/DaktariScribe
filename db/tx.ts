/**
 * Interactive transactions (SELECT … FOR UPDATE) for the few operations that need them,
 * e.g. activating a pass exactly once per payment. Uses Neon's WebSocket Pool driver;
 * Node 22+ provides a global WebSocket. Server only.
 */
import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { DatabaseNotConfiguredError } from './index';
import * as schema from './schema';

export type TxDb = NeonDatabase<typeof schema>;
type Tx = Parameters<Parameters<TxDb['transaction']>[0]>[0];

export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    return await db.transaction(fn);
  } finally {
    await pool.end();
  }
}
