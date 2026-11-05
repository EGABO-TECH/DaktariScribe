/**
 * Seeds the global templates. Safe to re-run: existing templates are updated in place
 * only when the seed's version is newer.
 *
 * Usage: npm run db:seed   (reads DATABASE_URL from .env.local)
 */
import { sql } from 'drizzle-orm';
import { getDb, schema } from './index';
import { GLOBAL_TEMPLATES } from '../lib/templates/global-templates';
import { templateDefinition } from '../lib/templates/definition';

async function main() {
  const db = getDb();
  for (const t of GLOBAL_TEMPLATES) {
    templateDefinition.parse(t.definition);
    await db
      .insert(schema.template)
      .values({ id: t.id, orgId: null, name: t.name, version: t.version, definition: t.definition, isActive: true })
      .onConflictDoUpdate({
        target: schema.template.id,
        set: { name: t.name, version: t.version, definition: t.definition, updatedAt: new Date() },
        setWhere: sql`${schema.template.version} < ${t.version}`,
      });
    console.log(`seeded template ${t.id} v${t.version}`);
  }
}

main().catch((err) => {
  console.error('seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
