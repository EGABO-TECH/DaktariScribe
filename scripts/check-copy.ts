/**
 * check-copy — fails CI when user-facing copy reads like an AI product (spec §1.5).
 *
 * Scans:   messages/*.json, app/**\/*.tsx, components/**\/*.tsx
 * Excludes: app/legal/** (plain disclosure of automated processing is required there)
 * Checks:  JSX text and string literals only (not identifiers, imports or type literals).
 * Allowlist: scripts/copy-allowlist.txt — one phrase per line (case-insensitive);
 *            a banned word inside an allowlisted phrase is ignored.
 *
 * Usage: npm run check:copy
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const BANNED_WORDS: RegExp[] = [
  /\bai(?:-powered)?\b/i,
  /\bartificial intelligence\b/i,
  /\bclinical intelligence\b/i,
  /\bsmart\b/i,
  /\bmagic(?:al)?\b/i,
  /\bintelligent\b/i,
  /\bcopilots?\b/i,
  /\bassistants?\b/i,
  /\bagents?\b/i,
  /\bmodels?\b/i,
  /\bllms?\b/i,
  /\bgpt\b/i,
  /\bgenerat(?:e|ed|es|ing)\b/i,
  /\bsynthesi[sz](?:e|ed|es|ing|is)\b/i,
  /\bhallucinat(?:e|ed|es|ion|ions)\b/i,
  /\bprompts?\b/i,
];

export const BANNED_ICONS = ['auto_awesome', 'smart_toy', 'psychology'];

export type Hit = { file: string; line: number; text: string; match: string };

export function loadAllowlist(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.toLowerCase());
}

/** Returns the first banned term found in `text`, after removing allowlisted phrases. */
export function findBanned(text: string, allowlist: string[] = []): string | null {
  let t = text;
  for (const phrase of allowlist) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    t = t.replace(re, ' ');
  }
  for (const icon of BANNED_ICONS) {
    if (new RegExp(`(^|[^a-z_])${icon}([^a-z_]|$)`, 'i').test(t)) return icon;
  }
  for (const re of BANNED_WORDS) {
    const m = t.match(re);
    if (m) return m[0];
  }
  return null;
}

/** True when a string literal is not user-facing copy (imports, type literals, comparisons, keys). */
function isNonCopyLiteral(node: ts.Node): boolean {
  const p = node.parent;
  if (!p) return false;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isLiteralTypeNode(p)) return true;
  if (ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
  if (ts.isBinaryExpression(p)) {
    const k = p.operatorToken.kind;
    if (
      k === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      k === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      k === ts.SyntaxKind.EqualsEqualsToken ||
      k === ts.SyntaxKind.ExclamationEqualsToken
    )
      return true;
  }
  if (ts.isCaseClause(p)) return true;
  if (ts.isElementAccessExpression(p)) return true;
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  if (ts.isJsxAttribute(p)) {
    const name = p.name.getText();
    if (['className', 'key', 'id', 'htmlFor', 'name', 'type', 'href', 'src', 'role'].includes(name)) return true;
  }
  return false;
}

export function scanTsx(source: string, file: string, allowlist: string[] = []): Hit[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: Hit[] = [];
  const check = (node: ts.Node, text: string) => {
    const match = findBanned(text, allowlist);
    if (match) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      hits.push({ file, line: line + 1, text: text.trim().slice(0, 120), match });
    }
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (node.text.trim()) check(node, node.text);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isNonCopyLiteral(node)) check(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      check(node, [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' '));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

export function scanJson(source: string, file: string, allowlist: string[] = []): Hit[] {
  const hits: Hit[] = [];
  const walk = (v: unknown, keyPath: string) => {
    if (typeof v === 'string') {
      const match = findBanned(v, allowlist);
      if (match) hits.push({ file, line: 0, text: `${keyPath}: ${v.slice(0, 100)}`, match });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${keyPath}[${i}]`));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, keyPath ? `${keyPath}.${k}` : k);
  };
  walk(JSON.parse(source), '');
  return hits;
}

function listFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

export function run(root: string): Hit[] {
  const allowlist = loadAllowlist(path.join(root, 'scripts', 'copy-allowlist.txt'));
  const rel = (f: string) => path.relative(root, f).split(path.sep).join('/');
  const tsx = [...listFiles(path.join(root, 'app'), '.tsx'), ...listFiles(path.join(root, 'components'), '.tsx')].filter(
    (f) => !rel(f).startsWith('app/legal/'),
  );
  const json = listFiles(path.join(root, 'messages'), '.json');
  const hits: Hit[] = [];
  for (const f of tsx) hits.push(...scanTsx(fs.readFileSync(f, 'utf8'), rel(f), allowlist));
  for (const f of json) hits.push(...scanJson(fs.readFileSync(f, 'utf8'), rel(f), allowlist));
  return hits;
}

const isMain = typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isMain) {
  const hits = run(process.cwd());
  if (hits.length) {
    console.error(`check-copy: ${hits.length} banned term(s) in user-facing copy (spec §1.5):\n`);
    for (const h of hits) console.error(`  ${h.file}${h.line ? `:${h.line}` : ''}  [${h.match}]  ${h.text}`);
    console.error('\nRephrase (see DESIGN.md §7) or, for a legitimate use, add the phrase to scripts/copy-allowlist.txt.');
    process.exit(1);
  }
  console.log('check-copy: OK');
}
