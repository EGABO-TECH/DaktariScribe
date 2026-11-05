/**
 * Private object storage (spec §3, §6.3). Server only.
 *
 * Every object is encrypted with AES-256-GCM (lib/crypto) BEFORE it is written, so neither the
 * bucket nor the database ever holds plaintext audio or documents. Objects are only read back
 * through authenticated, org-scoped API routes; there are no public or long-lived links.
 *
 * Backend: Cloudflare R2 when R2_* env vars are set, otherwise an encrypted Postgres table
 * (fine for development and small installs; R2 is recommended in production).
 */
import { and, eq, like } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { decryptBuffer, encryptBuffer } from '@/lib/crypto';

export interface ObjectStore {
  readonly kind: 'r2' | 'db';
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  list(prefix: string): Promise<string[]>;
  remove(key: string): Promise<void>;
}

export function isR2Configured(): boolean {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

class DbStore implements ObjectStore {
  readonly kind = 'db' as const;
  async put(key: string, data: Buffer) {
    await getDb()
      .insert(schema.blob)
      .values({ key, data, bytes: data.length })
      .onConflictDoUpdate({ target: schema.blob.key, set: { data, bytes: data.length, updatedAt: new Date() } });
  }
  async get(key: string) {
    const [row] = await getDb().select({ data: schema.blob.data }).from(schema.blob).where(eq(schema.blob.key, key)).limit(1);
    return row ? row.data : null;
  }
  async list(prefix: string) {
    const rows = await getDb()
      .select({ key: schema.blob.key })
      .from(schema.blob)
      .where(and(like(schema.blob.key, `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)));
    return rows.map((r) => r.key).sort();
  }
  async remove(key: string) {
    await getDb().delete(schema.blob).where(eq(schema.blob.key, key));
  }
}

class R2Store implements ObjectStore {
  readonly kind = 'r2' as const;
  private bucket = process.env.R2_BUCKET!;
  private clientPromise = import('@aws-sdk/client-s3').then(
    ({ S3Client }) =>
      new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
      }),
  );
  async put(key: string, data: Buffer) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await (await this.clientPromise).send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: 'application/octet-stream' }),
    );
  }
  async get(key: string) {
    const { GetObjectCommand, NoSuchKey } = await import('@aws-sdk/client-s3');
    try {
      const res = await (await this.clientPromise).send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }
  async list(prefix: string) {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const res = await (await this.clientPromise).send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const o of res.Contents ?? []) if (o.Key) keys.push(o.Key);
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return keys.sort();
  }
  async remove(key: string) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await (await this.clientPromise).send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let store: ObjectStore | null = null;
function raw(): ObjectStore {
  return (store ??= isR2Configured() ? new R2Store() : new DbStore());
}

/** Encrypting facade used by the rest of the app. */
export const storage = {
  kind: () => raw().kind,
  async put(key: string, plain: Buffer) {
    await raw().put(key, encryptBuffer(plain));
  },
  async get(key: string): Promise<Buffer | null> {
    const enc = await raw().get(key);
    return enc ? decryptBuffer(enc) : null;
  },
  list: (prefix: string) => raw().list(prefix),
  remove: (key: string) => raw().remove(key),
};

// ── Upload layout ────────────────────────────────────────────────────────────
// sources/<sourceId>/files/<fileIndex 4 digits>/part-<partNo 5 digits>

export const MAX_PART_BYTES = 4 * 1024 * 1024; // under the 4.5 MB serverless body limit
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function partKey(sourceId: string, fileIndex: number, partNo: number) {
  return `sources/${sourceId}/files/${String(fileIndex).padStart(4, '0')}/part-${String(partNo).padStart(5, '0')}`;
}

export function sourcePrefix(sourceId: string) {
  return `sources/${sourceId}/files/`;
}

/** Parts received so far, grouped by file index. */
export async function receivedParts(sourceId: string): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  for (const key of await storage.list(sourcePrefix(sourceId))) {
    const m = key.match(/files\/(\d{4})\/part-(\d{5})$/);
    if (!m) continue;
    const f = Number(m[1]);
    (out.get(f) ?? out.set(f, []).get(f)!).push(Number(m[2]));
  }
  for (const v of out.values()) v.sort((a, b) => a - b);
  return out;
}

/** Reassembles one file from its parts (decrypting each). */
export async function readFile(sourceId: string, fileIndex: number, parts: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for (let p = 0; p < parts; p++) {
    const b = await storage.get(partKey(sourceId, fileIndex, p));
    if (!b) throw new Error(`Missing part ${p} of file ${fileIndex}`);
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}
