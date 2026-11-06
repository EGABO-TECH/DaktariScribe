# DaktariScribe — Build Spec for Claude Code

> Hand this file to Claude Code at the root of the `DaktariScribe` repo (`https://github.com/EGABO-TECH/DaktariScribe`).
> It turns the current UI mockup into a working product **without changing the core idea**.
> Work through it phase by phase. Do not skip the gates.

---

## ▶ Start here (first session)

**You (the owner), before opening Claude Code:**

1. Save this file as `DAKTARISCRIBE_BUILD_SPEC.md` in the repo root, then commit it on a new branch: `git checkout -b build/phase-1`.
2. Create free accounts and keep the keys ready: **Neon** (database), **Cloudflare R2** (storage), **Inngest** (jobs), **AssemblyAI** (English speech), **Sunbird AI** (local languages), **Anthropic** (text processing, paid tier), **Nylon Pay** (sandbox keys). Only Neon is needed for Phase 1. The others can wait until their phase.
3. Copy `.env.example` (Section 3.1) to `.env.local` and fill in what you have. Never commit `.env.local`.
4. Install the two design skills (Section 1.1), then restart Claude Code.

**Then paste this into Claude Code as your first message:**

```text
Read DAKTARISCRIBE_BUILD_SPEC.md in full, plus AGENTS.md and the Next.js 16 docs it points to.
Then:
1. Run /impeccable init and /impeccable document (Section 1.2) and set up the ui-ux-pro-max design system. Apply Section 1.5 ("No AI look") to PRODUCT.md and DESIGN.md.
2. Do the Section 2.1 clean-up of AI wording across the existing pages.
3. Start Phase 1. Work in small commits. Stop at Gate 1 and report what's done, what's next, and any keys you need from me.
Ask me before installing paid services or if anything in the spec conflicts with the code.
```

**At the start of each later session:** "Continue DAKTARISCRIBE_BUILD_SPEC.md from Phase N. Re-read Sections 0, 1.5 and the Phase N section first."

---

## 0. Read this first (ground rules)

### 0.1 What the product is

DaktariScribe lets healthcare practitioners and field workers capture an encounter in three ways:

- **typing** notes,
- **recording** a voice interview, or
- **uploading** what they wrote (photos of handwriting, PDF, Word, Excel/CSV).

The system then **refines** that material into a clean, structured record **without inventing or changing anything**. The worker reviews it and signs it off. The record can then be exported as a **PDF report**, a **Word document**, or a **slide presentation of the metrics**, in the **language the clinician chooses**.

It must work in **low-connectivity** areas and keep patient data **private**.

### 0.2 Non-negotiable rules

1. **Never invent clinical content.** The AI may organise, correct spelling and grammar, expand approved abbreviations, file sentences under template headings, and extract numbers that were stated. It may **never** add a symptom, diagnosis, dose, result or recommendation that is not in the source. This is enforced in code (Phase 2), not just in prompts.
2. **Originals are immutable.** Raw text, audio and uploaded files are stored unchanged forever. Refinements and translations are separate, versioned layers on top.
3. **No secrets in code.** API keys are read only on the server from `process.env`. Never prefix a secret with `NEXT_PUBLIC_`. Never commit `.env*` (already in `.gitignore`, so keep it there). The repo is public.
4. **No patient data to AI tiers that train on it.** Use paid, no-training API tiers only. **Never use the Gemini free tier** for patient data: its terms allow human review and product use. Pseudonymise before every AI call (Phase 6).
5. **No patient content in logs.** Log record IDs and actions only, never note text, transcripts, prompts or AI responses.
6. **Offline first for capture.** Typing, recording, attaching files and making a draft PDF must work with no network.
7. **It must not look or read like an AI product.** DaktariScribe presents as a professional clinical documentation and reporting tool. Automated processing happens quietly in the background. See Section 1.5. This applies to every screen, export, email and marketing page.

### 0.3 This is Next.js 16

`AGENTS.md` says: *"This is NOT the Next.js you know."* Before writing any routing, middleware, caching or server-action code, read the relevant guide in `node_modules/next/dist/docs/`, and follow any deprecation notices there. Do not rely on memory of older Next.js versions. The same goes for `@clerk/nextjs` v7: check its current docs for the server helpers (`auth()`, `clerkMiddleware`).

### 0.4 How to work

- **One phase at a time.** At the end of each phase run `npm run lint`, `npx tsc --noEmit`, `npm run build`, and the phase's tests. Fix all errors. Commit with a conventional message (`feat(phase-1): …`). Then pause and summarise what changed and what's next.
- If a step needs an API key or an account that isn't in `.env.local`, **stop and ask**. Don't stub it silently. Write the code behind a clear interface, add the variable to `.env.example`, and continue with the parts that don't need it.
- **Verify external APIs against their current docs** before coding against them (AssemblyAI parameter names, Sunbird routes, Inngest, Serwist). The details below were correct when this spec was written, but they change.
- Keep the existing visual identity (Section 1) unless the design skills say a change fixes a real usability problem.

---

## 1. Design skills: impeccable + ui-ux-pro-max

Use **both** skills for every UI change. ui-ux-pro-max supplies the design-system reasoning (style, palette, typography, charts, UX rules for healthcare). impeccable supplies the critique, audit and polish loop and keeps quality high.

### 1.1 Install (once)

```bash
# ui-ux-pro-max (pick one)
# inside Claude Code:
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
# or from the project root:
npm install -g uipro-cli && uipro init --ai claude

# impeccable (pick one)
# inside Claude Code:
/plugin marketplace add pbakaus/impeccable      # then /plugin → install Impeccable
# or from the project root:
npx impeccable install                          # accept the design hook
```

Restart Claude Code after installing. Confirm both with `/plugin`.

> If a skill is not available in your environment, tell the user and continue using the written design rules in 1.4.

### 1.2 Set up the design context (before Phase 1 UI work)

1. Run **`/impeccable init`**. When asked, describe the product with this:
   > DaktariScribe is a clinical documentation tool for healthcare practitioners and field workers in Uganda and East Africa. Users work on mid-range Android phones and laptops, often outdoors, in bright light, with weak or no internet, sometimes wearing gloves, often mid-interview with a patient. Priorities: speed of capture, legibility, trust (clinical seriousness, not playful), accessibility (WCAG 2.2 AA), offline clarity (always show what's saved and what's pending), and presentable, print-quality exports.

   This writes `PRODUCT.md`.
2. Run **`/impeccable document`** to capture the existing visual system into `DESIGN.md` (tokens in `theme.css` and `app/globals.css`).
3. Ask **ui-ux-pro-max** for a design system for *"healthcare clinical documentation SaaS, mobile-first, Next.js + Tailwind v4, trustworthy, high legibility, data-dense dashboards"*. Reconcile its recommendations with the existing tokens and record the decisions in `DESIGN.md`. Use its chart guidance for the Insights page and slide charts.

### 1.3 Loop for every screen

For each screen you build or change:

1. Build it with the tokens in `DESIGN.md`.
2. `/impeccable critique <screen>`: fix everything scored below good.
3. `/impeccable audit <screen>`: fix all P0 and P1 issues (accessibility, performance, responsive, theming).
4. `/impeccable adapt <screen>`: check phone (360 px), tablet and desktop.
5. `/impeccable harden <screen>`: cover error, empty, loading, offline and slow-network states.
6. `/impeccable polish <screen>`: final pass before you commit.

Target narrowly: one screen or component per command.

### 1.4 Design rules that always apply

- **Keep the brand.** Primary `#001d3d` (navy), secondary `#006b5c` (clinical teal), surface `#f6fafd`, error `#ba1a1a`, plus the fonts already configured (Inter for body, Hanken Grotesk for headlines) and the Material Symbols Outlined icons. Add a dark theme using the same tokens.
- **Touch targets are at least 48 × 48 px.** The record, pause and stop controls are large and thumb-reachable on mobile (bottom of the screen).
- **Colour is never the only signal.** Status badges carry an icon and text as well: *Saved on device · Uploading · Transcribing · Ready for review · Final*.
- **The offline state is always visible**: a banner when offline, and a pending-sync count in the header.
- **Contrast is at least 4.5:1** for text, and the app stays legible in sunlight (no light-grey body text).
- **Amber flags** (`#b45309` or a token) mark uncertain items. Diff highlights mark what refinement changed. Both have text labels.
- **Animations stay small** and respect `prefers-reduced-motion`.
- **No dark patterns in billing.** Show prices clearly in UGX. Passes never auto-renew, so say so plainly.

---

### 1.5 No AI look (applies everywhere)

The product should feel like a dependable clinical records tool, like a well-made hospital form system or a modern EMR, **not** like an AI app. Users should feel in control of *their* notes. The software is the clerk; the clinician is the author.

**Never use:**

- **Words:** "AI", "AI-powered", "artificial intelligence", "smart", "magic", "intelligent", "copilot", "assistant", "agent", "model", "LLM", "GPT", "generate/generated", "synthesise", "clinical intelligence", "hallucination", "prompt".
- **Icons:** sparkles / stars (`auto_awesome`), robots (`smart_toy`), brains, magic wands, chat bubbles used to represent processing.
- **Visuals:** purple-to-blue gradients, glowing orbs, shimmer or "thinking" animations, typewriter text that streams in, glassmorphism hero cards, "neural" patterns, avatars for the software.
- **Interaction patterns:** chat interfaces, a "Ask DaktariScribe…" input, suggestion chips like "✨ Improve", streaming responses, "Regenerate" buttons.

**Use instead (plain, professional, action-led):**

| Instead of | Say |
| --- | --- |
| AI Synthesis / Generate report | **Organise notes** · **Prepare report** |
| AI transcription | **Transcribe** · **Transcript** |
| AI-generated draft | **Draft** · **Organised draft** |
| Regenerate | **Re-process** |
| AI is thinking… | A determinate progress bar with plain steps: *Uploading → Transcribing → Organising → Ready for review* |
| AI suggestion (ICD code) | **Suggested code — confirm** |
| Machine-translated | **Automatically translated** (and *Reviewed by [name]* when reviewed) |
| Voice-First Clinical Intelligence | **Field notes to finished reports** |
| Frontline Health AI | **For frontline health teams** |

**Visual direction:** calm clinical navy and teal (existing tokens), clean document-like surfaces, strong typography, tables and forms that look like well-designed official records, and status shown with clear badges. Exports look like formal reports from a health organisation, with nothing "generated" about them.

**Honesty still applies.** Do not hide automated processing where people need to know about it. The privacy policy, terms and sub-processor list must say that recordings and notes are processed by automated transcription and text-processing services (naming AssemblyAI, Sunbird AI and the text-processing provider), and that the clinician reviews and signs off everything. Use plain words such as "automated transcription", not product hype. The provenance line on exports stays: *"Prepared from original field notes captured by [worker] on [date]."*

**Enforce it:**

- Ask impeccable to flag generic "AI-looking" design during `critique` and `audit`, and treat any hit as P1.
- Add `scripts/check-copy.ts`, a CI check that fails on the banned words in user-facing strings (`messages/*.json`, `app/**/*.tsx`, `components/**/*.tsx`, excluding `app/legal/**`, where the plain disclosure is required) and on the banned icon names `auto_awesome`, `smart_toy` and `psychology`. Match whole words, case-insensitive, in JSX text and string literals only (not identifiers or imports). Support an allowlist file (`scripts/copy-allowlist.txt`) for legitimate uses such as the job title "Clinical Assistant".

## 2. Current state (verified)

| Area | State |
| --- | --- |
| Auth | Working. Clerk v7: `/`, `/register`, `/forgot-password`, `/sso-callback`, Google SSO. `middleware.ts` protects `/field-entry`, `/saved-records` and `/reports` |
| `/field-entry` | **Static mockup.** Toggle, CSS-only waveform, buttons with no handlers, no textarea logic, **no upload** |
| `/saved-records` | **Static mockup.** Hardcoded rows; filters do nothing |
| `/reports` | Uses a `mockReports` array. "Download PDF" calls `window.print()` (prints the whole page) |
| Backend | **None.** No `app/api`, no database, no storage, no AI calls |
| Landing page claims | "Offline-Ready", "Encrypted" and "Clinician-Vetted" are not built yet. Footer names the company two ways ("Clinical Network" and "Clinical Pharma Network"). Fix to one name |

### 2.1 AI wording to remove now (found in the current code)

| File | Current | Change to |
| --- | --- | --- |
| `components/landing/HeroSection.tsx` | Feature card icon `smart_toy`, title "AI Synthesis", text "Multi-model pipeline stabilises jargon and aggregates clinical findings." | Icon `fact_check` or `description`; title **"Organised Reports"**; text **"Your notes, tidied into a standard record. Nothing added, nothing lost."** |
| `components/landing/HeroSection.tsx` | Badge "Frontline Health AI"; tagline "Voice-First Clinical Intelligence" | **"For frontline health teams"**; **"Field notes to finished reports"** |
| `components/landing/HeroSection.tsx` | Heading "AI-Powered Voice & Text Medical Scribe…" | **"Voice and text field notes, turned into clear clinical reports."** (or similar; run `/impeccable clarify`) |
| `components/landing/HeroSection.tsx` | "Capture, synthesise, and report…" | **"Capture, organise and report clinical encounters in the field, even with weak internet."** |
| `components/landing/LandingFooter.tsx` | "Clinical Intelligence"; two different company names | One company name; remove "Clinical Intelligence" |
| `app/layout.tsx` | Metadata "clinical intelligence", "synthesize findings", keyword "healthcare AI" | Plain descriptions: "clinical documentation", "field reports", "health records" |
| `app/register/page.tsx` | "I understand that AI-generated outputs must be validated by a licensed clinician." | **"I understand that I must review and sign off every report before it is final."** |
| `app/legal/terms`, `privacy`, `compliance` | Hype and unverified claims ("multi-model AI pipeline", "evaluated quarterly", "model card for each AI component", staff training) | Rewrite in Phase 6 to describe **only what is true**, using plain disclosure language (Section 1.5 *Honesty*) |
| `public/assets/DaktariScribe-Logo-Tagline.png` | Image tagline "Voice-First Clinical Intelligence" | Use `DaktariScribe-Full-Logo.png` instead until a new tagline asset is made; flag this to the owner |
| `README.md` | "AI Synthesis", "clinical intelligence platform" | Same plain wording (the README may mention the providers in a technical section) |

**Keep:** the Clerk setup, the dashboard shell (`Sidebar`, `Header`, `BottomNav`), the record ID format `DS-YYYY-DD-MM-NANO-XXXX` (use `nanoid`), the month/day grouping on Reports, and the confidentiality notice.

---

## 3. Target stack (free tiers first)

| Layer | Use | Notes |
| --- | --- | --- |
| Framework | Next.js 16, React 19, TypeScript, Tailwind v4 (existing) | |
| Auth | Clerk (existing) | Add roles via Clerk Organizations: `worker`, `supervisor`, `admin`. **The Hobby plan has no MFA**, so before real patient data either upgrade Clerk or migrate to Better Auth (TOTP 2FA). Build behind an `auth` helper so a swap is easy |
| Database | Neon Postgres + **Drizzle ORM** + **Zod** | `@neondatabase/serverless` driver |
| File storage | **Cloudflare R2** (S3 API via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) | Private bucket. Presigned URLs expire after 5 minutes. Multipart uploads |
| Background jobs | **Inngest** (free tier) | Transcription, OCR, refinement, translation and export run as steps with retries |
| English STT | **AssemblyAI** Universal-3.5 Pro + Medical Mode + speaker labels + keyterms | About $0.43 per audio hour. Optional live captions via Universal-Streaming English |
| Local-language STT + translation | **Sunbird AI** (`https://api.sunbird.ai`) | 51-language STT; translation for English plus 67 African languages |
| Refinement, OCR, other translation | **One paid LLM** with structured JSON output and no training on API data. Default: Anthropic API (`claude-sonnet-5-5` for refinement, `claude-haiku-5-5` for translation and cheaper steps) behind a provider interface | Provider and model are set via env vars |
| Offline | **Serwist** (service worker) + **Dexie.js** (IndexedDB) + Web Crypto | |
| Exports | **`@react-pdf/renderer`**, **`docx`**, **`pptxgenjs`** | Embed Noto Sans fonts |
| Charts | **Recharts** (in app); native `pptxgenjs` charts (slides) | |
| i18n | **`next-intl`** | UI and fixed report labels |
| Payments | **Nylon Pay** (`@nile-squad/nylonpay-ts`): MTN MoMo, Airtel Money, Visa, bank transfer, in UGX | Minimum collection is UGX 500. No advertised subscriptions, so the app sells **prepaid passes** (Phase 7). Confirm fees and settlement times with Nylon Pay |
| Monitoring | Sentry (free) with PII capture **off** and request bodies scrubbed | |
| Security CI | GitHub secret scanning + push protection, Dependabot, `gitleaks`, `npm audit`, OWASP ZAP baseline | |
| Hosting | Vercel | Hobby = **non-commercial only**. Move to Pro before the first paying client |

### 3.1 `.env.example` (replace the current env list)

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/field-entry
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/field-entry

# Database (Neon)
DATABASE_URL=

# App-level encryption (32-byte base64 key; generate with: openssl rand -base64 32)
DATA_ENCRYPTION_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=daktariscribe-private

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# AssemblyAI (English STT)
ASSEMBLYAI_API_KEY=

# Sunbird AI (local-language STT + translation)
SUNBIRD_BASE_URL=https://api.sunbird.ai
SUNBIRD_USERNAME=
SUNBIRD_PASSWORD=

# LLM (refinement / OCR / translation) — paid, no-training tier only
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=
AI_MODEL_REFINE=claude-sonnet-5-5
AI_MODEL_FAST=claude-haiku-5-5

# Payments — Nylon Pay (sandbox keys start npk_sandbox_ / live keys npk_live_; secrets start nps_)
NYLONPAY_API_KEY=
NYLONPAY_API_SECRET=
NYLONPAY_WEBHOOK_SECRET=
# Optional override; the SDK has a default base URL
NYLONPAY_BASE_URL=
# Approximate rate used only for the internal cost ledger
USD_TO_UGX=3700

# Monitoring
SENTRY_DSN=
```

Remove the unused providers from the README env list (Google STT, Google Vision, Azure Vision, PDFShift, Gemini) unless a phase adds them back.

---

## 4. Data model (Drizzle, `db/schema.ts`)

All IDs are text. Records use the `DS-…` format, and other tables use `nanoid()`. Every table has `createdAt` and `updatedAt`. Columns marked 🔒 are encrypted in the app (AES-256-GCM with `DATA_ENCRYPTION_KEY`, via `lib/crypto.ts`) before they are written.

```
organisation   id, name, logoKey, plan, seatLimit, monthlyEncounterQuota, defaultLanguage, dataRegion
membership     id, orgId, clerkUserId, role ('worker'|'supervisor'|'admin'), status
template       id, orgId|null(global), name, version, definition JSONB (see 4.1), isActive
encounter      id ('DS-…'), orgId, workerId, templateId, templateVersion, site, encounterDate,
               respondentRef 🔒, consentObtained bool, interviewLanguage (ISO 639-3),
               status ('draft'|'processing'|'in_review'|'final'), currentVersionId, deviceCreatedAt
source         id, encounterId, kind ('text'|'audio'|'upload'), storageKey, mimeType, bytes,
               rawText 🔒 (typed text or extracted text), language, engine ('assemblyai'|'sunbird'|'llm-ocr'|'parser'),
               segments JSONB 🔒 [{start,end,speaker?,text,confidence?,page?}], status, error
refinedVersion id, encounterId, versionNo, createdBy ('ai'|clerkUserId), content JSONB 🔒 (RefinedRecord),
               verification JSONB (results of Phase 2 checks), parentVersionId
signoff        id, versionId, signerId, signedAt, statement
translation    id, versionId, targetLanguage, engine, content JSONB 🔒, reviewedBy|null, reviewedAt|null, qualityTier
export         id, orgId, scope JSONB (encounterIds or filter), format ('pdf'|'docx'|'pptx'), language,
               storageKey, createdBy, createdAt, watermark bool
usageEvent     id, orgId, userId, kind ('encounter'|'audio_seconds'|'translation_chars'|'llm_tokens'|'export'),
               quantity, costUsdMicros, encounterId|null, createdAt
payment        id, userId, orgId|null, reference (UUID, sent to Nylon Pay), productCode, amountUgx,
               method ('mobileMoney'|'card'|'bank'), phoneMasked, status ('pending'|'processing'|'successful'|'failed'|'cancelled'),
               providerTransactionId, rawEventIds JSONB, createdAt, settledAt
pass           id, userId, orgId|null, productCode, startsAt, endsAt, reportsTotal, reportsUsed,
               voiceSecondsTotal, voiceSecondsUsed, features JSONB, sourcePaymentId|null ('trial' for trials)
trialClaim     id, userId, phoneHash, deviceHash, claimedAt          # one trial per account AND per phone
invoice        id, orgId, amountUgx, status, providerRef, pdfKey     # team/organisation billing
auditLog       id, orgId, actorId, action, entityType, entityId, meta JSONB (no patient content), ip, createdAt
```

### 4.1 Template definition (JSON, validated with Zod)

```ts
type TemplateDefinition = {
  sections: Array<{
    key: string;                 // 'presenting_complaint'
    label: Record<string,string>;// { eng: 'Presenting complaint', lug: '…' } — human-translated
    fields: Array<{
      key: string;               // 'temperature_c'
      label: Record<string,string>;
      type: 'text'|'number'|'boolean'|'choice'|'date';
      unit?: string;             // '°C'
      choices?: string[];
      metric?: boolean;          // true → used in Insights and slide charts
      required?: boolean;
    }>;
  }>;
};
```

Seed these global templates: **General consultation**, **Antenatal visit**, **Immunisation session**, **Community survey / interview**, and **Custom (free sections)**.

### 4.2 RefinedRecord (the model's output shape)

```ts
type SourceSpan = { sourceId: string; start: number; end: number }; // char offsets in source.rawText
type RefinedLine = { text: string; spans: SourceSpan[]; flags?: Flag[] };
type Flag = { kind: 'unclear_audio'|'illegible'|'unknown_abbreviation'|'possible_conflict'|'not_in_source';
              note: string };
type RefinedRecord = {
  sections: Array<{ key: string; lines: RefinedLine[] }>;
  fields: Array<{ key: string; value: string|number|boolean|null; spans: SourceSpan[];
                  status: 'recorded'|'not_recorded' }>;
  suggestedCodes?: Array<{ system: 'ICD-10'|'ICD-11'; code: string; label: string;
                           forLineIndex: number; confirmed: false }>;
};
```

---

## 5. Phases

### Phase 1: Make it real (text path end to end)

**Goal:** a typed note becomes a saved, signed record with a real PDF.

1. Set up Drizzle and Neon, create `db/schema.ts`, write migrations, and add a seed script for templates.
2. Add `lib/auth.ts`, which wraps Clerk to return `{ userId, orgId, role }`. Every API route and server action calls it and **filters every query by `orgId`**. Workers see only their own encounters; supervisors and admins see the whole organisation.
3. **`/field-entry` rebuilt** (client component):
   - Header form: template, site, date, respondent ref, consent checkbox (required to save), interview language.
   - Tabs: **Type**, **Record** (Phase 3), **Upload** (Phase 3). Keep the existing Dictation/Manual visual style.
   - Type tab: a real `<textarea>` with autosave to IndexedDB every 3 s and on blur (Dexie). Phase 4 adds encryption, but design the storage layer now.
   - "Save draft" and "Process" buttons. Process creates the `encounter` and `source` on the server.
4. **`/saved-records`**: real data, server-side pagination, working filters (record ID search, date range, site, status, worker for supervisors), and status badges.
5. **Record detail page** `/records/[id]`: header, sources, current version, sign-off action, and history.
6. **PDF export v1** with `@react-pdf/renderer` in `app/api/exports/[id]/route.ts`. Branded layout: logo, title, record ID, site, date, author, sections, fields table, *"Not recorded"* for empty fields, signature block, provenance line, confidentiality notice and page numbers on every page. **Delete the `window.print()` handler.**
7. Make `/reports` read real final records (keep the month/day grouping), with per-record PDF download.
8. Apply Section 2.1 (remove AI wording and icons) and fix the landing-page footer name. Soften "Offline-Ready", "Encrypted" and "Clinician-Vetted" to "Coming soon" until Phases 4 and 6 ship them.
9. Run the design loop (1.3) on Field Entry, Saved Records, Record detail and Reports.

**Gate 1:** a worker signs in, types a note, saves, signs off, and downloads a correct PDF. Build, lint and type-check are clean.

### Phase 2: Faithful refinement (the core promise)

**Goal:** refinement that provably adds nothing.

1. Add `lib/ai/provider.ts`, an interface `{ refine(), translate(), ocr() }` with an Anthropic implementation. Calls use temperature 0 and structured output (JSON schema = `RefinedRecord`). Use the provider's JSON-schema / tool-use mode, not free text.
2. **Refinement prompt** (`lib/ai/prompts/refine.ts`). The system prompt must say, in substance:
   - You are a clinical documentation **editor**, not a clinician.
   - Use **only** facts present in the SOURCE. Never add, infer, generalise, calculate or "complete" clinical information.
   - Allowed: fix spelling and grammar; expand abbreviations **only** from the provided ABBREVIATIONS list; place each sentence under the best template section; extract values explicitly stated into fields.
   - If a field isn't stated, set `status: 'not_recorded'` and `value: null`.
   - Every line and field must include `spans` pointing to the exact source characters it came from.
   - If something is unclear, keep the original wording and add a flag. Never guess.
   - Diagnosis codes go only in `suggestedCodes`, only for a diagnosis the worker explicitly wrote, always `confirmed: false`.

   Inputs: template definition, abbreviation list (`lib/clinical/abbreviations.ts`, a curated list such as BP, HR, RR, SpO2, RDT, ANC, HIV, TB, PCM, ORS, IM, IV, PO, BD, TDS, OD, PRN, with expansions), and the pseudonymised source text with stable char offsets.
3. **Verification in code** (`lib/verify/`), run on every AI output before saving:
   - `spans.ts`: every line and field has at least one span; spans are within bounds; each line shares meaningful tokens with its spanned text. A line with no span → `not_in_source` flag, and it's hidden from Final until the worker accepts or edits it.
   - `numbers.ts`: extract every number (with units), date, dose and percentage from the output. Each must appear in the source (normalise "38.5", "38,5", "thirty-eight point five" where feasible). A mismatch → blocking flag.
   - `drugs.ts`: drug names in the output must appear in the source (fuzzy match allowed for spelling fixes only, Levenshtein ≤ 2, recorded as a change).
   - `negation.ts`: if the source says "no fever" and the output drops the negation, that's a blocking flag (simple pattern check on "no / not / denies / negative").
   - Store the results in `refinedVersion.verification`.
4. **Review screen** `/records/[id]/review`: split view with the original on the left and the refined version on the right. Clicking a refined line highlights its source span (and plays the audio segment once Phase 3 lands). Changes are highlighted in a diff. Each line can be accepted, edited or rejected. Flags are listed at the top. Sign-off is disabled while blocking flags remain.
5. Run refinement as an **Inngest** function `encounter/refine.requested`, with retries and a status update.
6. **Evaluation harness** `scripts/eval-refine.ts`: runs on `eval/fixtures/*.json` (source text plus a clinician-labelled fact list) and reports added, dropped and changed facts. Add 10 synthetic fixtures now; the team will add 30–50 real anonymised ones. **Never commit real patient data. Fixtures must be synthetic or fully de-identified.**
7. Design loop on the Review screen (this is the most important screen).

**Gate 2:** 0 added facts across all fixtures; the verification unit tests pass; sign-off is blocked when blocking flags exist.

### Phase 3: Voice and upload

#### 3a. Recording (client)

- `getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 16000 } })`.
- `MediaRecorder` with Opus (`audio/webm;codecs=opus`; fall back to `audio/mp4` on iOS Safari).
- **Segments:** restart the recorder every **5 minutes** so each segment is a self-contained file (this avoids Sunbird's trim rule for files over 100 MB / 10 minutes and keeps uploads small). Within a segment, emit `timeslice` chunks every 30 s into Dexie.
- Real **level meter** via the Web Audio `AnalyserNode`, replacing the CSS waveform. Warn on silence for more than 10 s and on clipping.
- Pause, resume and stop, a timer, and a "saved on device" indicator per segment.
- Upload each finished segment to R2 with **multipart** presigned URLs (`app/api/uploads/*`), resumable after a dropped connection.

#### 3b. Transcription (server, Inngest `source/transcribe.requested`)

- **Router:** `interviewLanguage === 'eng'` → AssemblyAI. Any other supported code → Sunbird. Store `engine` on the `source`.
- **AssemblyAI:** upload the audio, then create a transcript with Universal-3.5 Pro, **Medical Mode**, **speaker labels**, and **keyterms** (load from `lib/clinical/keyterms.ts`: Uganda essential medicines, common local place and facility names, and the organisation's custom terms). **Check the current AssemblyAI docs for exact parameter names before coding.** Poll or use a webhook. Save the words, segments, speakers and confidence. Words with confidence below 0.6 → `unclear_audio` flag.
- **Sunbird STT:** `POST {SUNBIRD_BASE_URL}/tasks/audio/transcriptions`, multipart with `audio`, `language` (ISO 639-3, **required**: auto-detect is unreliable) and `timestamps=true`. **Send no other fields** (since v2.1, `adapter`, `recognise_speakers`, `whisper` and similar return 422). Check `was_audio_trimmed`; if true, fail loudly and re-split. There are no speaker labels and no confidence scores, so mark the transcript single-speaker and let the worker tag turns in review.
- **Sunbird auth** (`lib/sunbird/auth.ts`): OAuth2 password flow at `/auth/token`. Tokens last 7 days, so cache the token server-side and refresh it on 401 or near expiry. **The token never reaches the browser.**
- **Hallucination guard for Whisper-based output:** drop segments that are pure silence (simple energy-based VAD before upload, or skip empty segments), and collapse a phrase repeated 3 or more times in a row (a known Whisper failure mode). Flag what was removed.
- **Fallback:** if the primary engine fails after retries, try the other one (Sunbird supports `eng`; AssemblyAI supports English only). Record which engine produced each segment.
- **Stitch** segments with time offsets into one `source.segments` array.
- **Optional live captions** (English only): a Universal-Streaming English WebSocket through a short-lived token issued by a server route. Captions are a preview only; the final record always uses the batch transcript.

#### 3c. Uploads

- Accept JPG, PNG, HEIC (convert to JPEG client-side), PDF, DOCX, XLSX and CSV, up to 20 MB each. Compress images to about 1600 px on the long edge before upload.
- **Extraction** (Inngest `source/extract.requested`):
  - DOCX → `mammoth` (raw text).
  - XLSX/CSV → `xlsx` / `papaparse`, converting rows to "Column: value" lines.
  - Text PDF → `pdf-parse`. Scanned PDF or image → LLM vision OCR with a strict transcribe-only prompt ("Transcribe exactly. Do not correct, summarise or add. Mark illegible words as [illegible]"). Keep page refs.
  - Optional instant offline preview with `tesseract.js` for printed text, labelled "preview".
- All extracted text goes into `source.rawText` and then the same refinement pipeline.

#### 3d. Review additions

- Clicking a transcript line plays its audio segment (short-lived presigned URL).
- For local-language interviews, the review shows **three columns**: original transcript · English translation · refined record. The Phase 2 number, date and drug checks run against the **original-language transcript and its translation**.

**Gate 3:** record a 12-minute interview offline, reconnect, and get a correct stitched transcript with no trimming. A photo of handwritten notes and a DOCX both flow through to a reviewed, signed record. Run a trial with one real field team.

### Phase 4: Low-connectivity

1. **Serwist** service worker: precache the app shell, fonts (Inter, Hanken Grotesk, Noto Sans, Material Symbols), logos, templates and the i18n catalogues. The app opens fully offline after the first visit. Add a web app manifest so the PWA is installable.
2. **Dexie schema:** `drafts`, `audioChunks`, `attachments`, `outbox`, `cachedRecords`.
3. **Device encryption:** derive an AES-GCM key from a worker PIN (PBKDF2, at least 310,000 iterations, random salt) with Web Crypto. Everything in Dexie is encrypted. Auto-lock after 10 minutes idle. **Logging out wipes Dexie.**
4. **Outbox sync:** one item at a time with exponential backoff. Uses Background Sync where supported, and retries when the app opens and on `online` events. Idempotency keys stop records being created twice.
5. **Offline sign-in:** after a successful Clerk sign-in, allow PIN unlock offline until the Clerk session expires. When it expires, require sign-in again once online.
6. **Offline PDF:** render the draft or cached record PDF in the browser with `@react-pdf/renderer` (same components as the server, so the output matches).
7. **UI:** offline banner, header pending-sync counter, per-record status badges, and a "Sync now" button.
8. Test with Chrome DevTools "Offline" and "Slow 3G", and on a low-end Android device.

**Gate 4:** a full day of capture in airplane mode loses nothing and syncs cleanly afterwards.

### Phase 5: Outputs, languages and insights

1. **Exports** (Inngest `export/requested`; files stored in R2; download via a presigned URL):
   - **PDF:** `@react-pdf/renderer`, layout as in Phase 1, plus an optional appendix with the original transcript.
   - **Word:** `docx`, the same structure with real Word headings and tables (editable).
   - **Slides:** `pptxgenjs`: title slide, a summary slide with headline numbers, **one native chart per metric field** (by condition, site, age group, day), notable cases, follow-ups due. **If a template has no metric fields, skip the chart slides.** Never invent figures.
   - **Single vs aggregate:** one record, or a filter (date range, site, worker, template). Aggregates are computed in SQL from confirmed fields, never by the model.
   - Every export has the logo(s), title, record IDs, site, dates, author, sign-off time, *"Not recorded"* for blanks, a provenance line, the confidentiality notice and page numbers.
   - **Free-trial exports carry a "DaktariScribe Trial" footer mark.** Paid passes have no watermark.
2. **Output language:**
   - The export dialog has a language picker with a quality-tier badge.
   - **Fixed labels** (headings, field labels, notices) come from `next-intl` catalogues in `messages/<lang>.json`, which a fluent speaker reviews. **Never machine-translate them at export time.**
   - **Content** is translated field by field. **Placeholder protection:** before translating, replace every number + unit, date, dose, drug name, record ID and name placeholder with tokens such as `⟦N1⟧`. Restore them after translating, and fail if any token is missing or altered.
   - Engine: Sunbird `POST /tasks/translate` (`{ source_language, target_language, text }` → `output.translated_text`) for African languages; the LLM (`AI_MODEL_FAST`, temperature 0, translate-only prompt) for others such as French and Arabic.
   - Each translation is stored as a `translation` row. Optional side-by-side review. The export states *"Automatically translated from English on [date]; reviewed by [name]"* or *"not yet reviewed"*.
   - Embed **Noto Sans** (Latin, Ethiopic, Arabic) in PDF, DOCX and PPTX so all scripts render. Format dates and numbers with `Intl` for the locale.
3. **Insights page** `/insights` (supervisors): Recharts charts of metric fields over time and by site; filters; and a "Build deck" button that opens the export dialog with the same filter.
4. Design loop on the export dialog, Insights and all three export templates. Open the generated files and check them visually: run `/impeccable critique` on screenshots of the rendered PDF and slides.

**Gate 5:** a supervisor builds a Luganda PDF, an English Word document and an English slide deck from one week of records, and all three show identical facts and numbers.

### Phase 6: Security hardening

1. **Pseudonymiser** (`lib/privacy/pseudonymise.ts`): before any call to AssemblyAI, Sunbird translate or the LLM where text is sent, replace names, phone numbers (Ugandan formats `+256…`, `07…`), NIN patterns, emails and the respondent ref with stable placeholders (`⟦PERSON_1⟧`). Keep the map server-side for that request only, and restore after the response. (Audio can't be pseudonymised. Document that in the privacy policy and only use providers with no-training terms.)
2. **Field encryption** (`lib/crypto.ts`): AES-256-GCM with a random IV per value, key from `DATA_ENCRYPTION_KEY`, and a key version prefix to allow rotation.
3. **R2:** a private bucket; audio and uploads are encrypted client-side or server-side before `PutObject`; presigned GET URLs expire after 300 s and are issued only after an `orgId` and role check.
4. **Headers** (`next.config.ts` / middleware): HSTS, a strict CSP (self, Clerk domains, R2 presigned host, Inngest; **no third-party analytics on app routes**), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (microphone=self).
5. **API hygiene:** validate every input with Zod, rate-limit sensitive routes (Upstash Ratelimit free tier, or a simple Postgres token bucket), and return generic error messages.
6. **Logging:** a `logger` that drops any field named `text|transcript|prompt|content|rawText`. Sentry with `sendDefaultPii: false` and `beforeSend` scrubbing.
7. **Audit log:** write on view, edit, sign-off, export, translate, login and role change. Supervisors and admins can view it.
8. **MFA:** enforce it for all roles before production data (upgrade Clerk, or migrate to Better Auth with TOTP).
9. **CI** (`.github/workflows/ci.yml`): lint, type-check, test, build, `scripts/check-copy.ts` (Section 1.5), `gitleaks`, `npm audit --audit-level=high`, and an OWASP ZAP baseline against the preview URL. Turn on GitHub secret scanning, push protection and Dependabot.
10. **Separate environments:** preview and production use different databases, buckets and keys. Preview deployments are protected by Vercel Authentication.
11. Update `/legal/privacy`, `/legal/security` and `/legal/compliance` to describe what is actually implemented, including the AI sub-processors (AssemblyAI, Sunbird, LLM provider), consent per encounter, and Uganda's Data Protection and Privacy Act, 2019. Add a note that legal review is required before launch.
12. Run `/impeccable harden` on every screen that shows patient data.

**Gate 6:** the ZAP baseline has no high findings; `gitleaks` is clean; manual tests confirm a worker cannot read another worker's record by changing the ID, and expired links fail.

### Phase 7: Billing (prepaid passes in UGX with Nylon Pay)

**Model:** individual clinicians buy **prepaid passes** with mobile money, the same way they buy data bundles. Passes **never auto-renew**: Nylon Pay doesn't advertise subscriptions, and mobile money can't be debited automatically. Every new account gets a **7-day free trial**. Organisations are invoiced per worker.

#### 7.1 Products (put these in `lib/billing/plans.ts`, not hardcoded in components)

```ts
export const PRODUCTS = {
  trial:        { priceUgx: 0,      days: 7,  reports: 10,  voiceMin: 20,  features: ['pdf','docx','translate_1'], exportMark: 'Trial' },
  daily:        { priceUgx: 500,    days: 1,  reports: 3,   voiceMin: 5,   features: ['pdf'] },
  weekly:       { priceUgx: 2_000,  days: 7,  reports: 15,  voiceMin: 20,  features: ['pdf','docx','translate_1'] },
  monthly_basic:{ priceUgx: 5_000,  days: 30, reports: 40,  voiceMin: 60,  features: ['pdf','docx','translate_all','templates'] },
  monthly_pro:  { priceUgx: 20_000, days: 30, reports: 150, voiceMin: 180, features: ['pdf','docx','pptx','translate_all','templates','insights','aggregate','custom_logo','priority'] },
  pro_quarter:  { priceUgx: 55_000, days: 90, reports: 450, voiceMin: 540, features: /* same as monthly_pro */ [] },
  topup_reports:{ priceUgx: 1_000,  addReports: 10 },   // adds to the active pass, ends with it
  topup_voice:  { priceUgx: 1_500,  addVoiceMin: 30 },  // adds to the active pass, ends with it
  team_seat:    { priceUgx: 25_000, days: 30, perSeat: true, minSeats: 5, features: /* monthly_pro + */ ['supervisor','team_reports'] },
} as const;
```

All prices are in whole UGX, and the Nylon Pay minimum (500) is respected. Set `pro_quarter.features` equal to `monthly_pro.features`. These are starting prices that the owner will tune, so keep every number in this file.

#### 7.2 Entitlement rules (`lib/billing/entitlements.ts`)

- **Counting a report:** a report is used when an encounter is first sent for AI processing. Re-running refinement on the same encounter is free. Voice seconds are counted from the actual transcribed duration.
- **Without an active pass or trial:** the user can still sign in, open, read and **export every Final record**, and can still capture drafts offline. Only new AI processing (STT, OCR, refinement, translation) is blocked, with a friendly "Buy a pass" sheet. Never hold a user's data hostage.
- **Buying the same product while active** extends `endsAt` and adds the allowances.
- **Upgrading** (for example Weekly → Monthly Pro) starts the new pass now and carries over unused reports and voice minutes.
- **Top-ups** need an active pass and expire with it.
- **Trial:** granted once per account **and** per phone number (`trialClaim.phoneHash` = SHA-256 of the normalised `+256…` number with a server salt). Ask for the phone number at trial start. Also record a device hash to discourage repeat trials.
- **Warnings:** show an in-app banner at 80% of reports or voice used, 2 days before expiry, and on the last day.

#### 7.3 Nylon Pay integration (`lib/billing/nylonpay.ts`)

Read the current SDK docs and README (`@nile-squad/nylonpay-ts`, docs at docs.nylonpay.com) and **confirm method names and payload shapes before coding**. The Python SDK, which shares the same API spec, exposes `collect_payment`, `get_status`, `get_transaction`, `create_invoice` and `verify_webhook_signature`. Expect camelCase equivalents in TypeScript (`collectPayment`, `getStatus`, `createInvoice`, `verifyWebhookSignature`).

- **Client:** created server-side only from `NYLONPAY_API_KEY` (`npk_…`) and `NYLONPAY_API_SECRET` (`nps_…`). Sandbox and live are determined by the key (`npk_sandbox_…` vs `npk_live_…`). Never expose either key to the browser.
- **Checkout flow:**
  1. On `/billing/buy`, the user picks a product and enters an MTN or Airtel number (validate the Uganda format; prefill from the profile).
  2. `POST /api/billing/checkout` creates a `payment` row (`status: 'pending'`, `reference = crypto.randomUUID()`, since the reference **must be a UUID**). The server derives the amount from `PRODUCTS`, **never from the client**. Then call `collectPayment({ amount, currency: 'UGX', method: 'mobileMoney', customer: { name, phoneNumber }, description: 'DaktariScribe Weekly pass', reference })`.
  3. The UI shows "Check your phone and enter your Mobile Money PIN" with a 2-minute countdown, and polls `GET /api/billing/payments/:reference` (which calls `getStatus` if no webhook has arrived yet).
  4. **Card or bank:** use `createInvoice({ amount, currency: 'UGX', description, items, redirectUrl })` and redirect to the hosted page. Card details never touch your server.
- **Webhook** `POST /api/webhooks/nylonpay`:
  - Read the **raw body** (don't re-serialise JSON) and verify the signature with `NYLONPAY_WEBHOOK_SECRET` (`verifyWebhookSignature`, freshness check on). Reject invalid signatures with 401.
  - Handle `transaction.successful`, `transaction.failed`, `transaction.processing` and `transaction.cancelled`.
  - **Idempotent:** store event IDs and ignore repeats. Activating a pass happens in a single DB transaction keyed on `payment.reference`, so it can only happen once.
  - On success: mark the payment `successful`, create or extend the `pass` per 7.2, write an `auditLog` entry, and show a receipt.
- **Reconciliation:** an Inngest cron every 10 minutes calls `getStatus` for payments that are still pending after 3 minutes, and expires them after 30 minutes.
- **Receipts:** a downloadable PDF receipt per payment (`@react-pdf/renderer`) with the reference, product, amount in UGX, date and masked phone number.
- **Refunds:** there's no refund endpoint. Refunds are a manual admin action using a payout (`makePayout`), which has a UGX 5,000 mobile-money minimum, so smaller refunds are handled as credit to the account. Document this in the Terms.

#### 7.4 Usage metering and cost ledger (`lib/billing/usage.ts`)

- Write a `usageEvent` for each report counted, the voice seconds per engine, translation characters, LLM tokens and exports.
- Estimate `costUsdMicros` from provider rates in config. Convert to UGX for the admin view with `USD_TO_UGX`.
- `/admin/costs` (admin only) shows revenue vs AI cost per product, per day and per user, the average cost per report (typed vs voice), and alerts when any product's margin falls below 20%.

#### 7.5 Organisations

- An org admin buys `team_seat` × N (minimum 5) by invoice or Nylon Pay hosted invoice, and invites workers through Clerk Organizations.
- Seats are enforced. All members get Monthly Pro features plus the supervisor role and team reports.
- An admin can "mark invoice paid" for bank transfers.

#### 7.6 Pages

- **`/pricing` (public):** pass cards in UGX (Daily · Weekly · Monthly Basic · **Monthly Pro (recommended)**) with the trial call to action, top-ups, a team plan contact form, an FAQ ("Does it renew automatically? No.", "What happens when my pass ends? You keep your records."), and **"We never sell or share patient data."**
- **`/billing` (signed in):** the current pass with time left, report and voice meters, a buy/upgrade/top-up sheet, payment history and receipts.
- **Pass status chip in the header:** "Weekly · 4 days · 9 reports left". Tapping it opens `/billing`.
- Design loop (Section 1.3), using ui-ux-pro-max pricing-page guidance and `/impeccable critique`, `clarify` and `polish`. Prices must be easy to compare on a 360 px screen, with the amount, duration and allowances in one glance. No dark patterns.

#### 7.7 Later (stubs only in this phase)

- **Research licence:** a fixed-term org plan with enumerator seats and a project end date, plus a Stata/SPSS-friendly CSV export with a codebook.
- **DHIS2 export:** map template metric fields to DHIS2 data elements in config and export an aggregate data-value set JSON.

**Never sell, share or advertise against patient data.**

**Gate 7:** in the Nylon Pay sandbox, a new user claims the trial (a second trial on the same phone is refused), buys a Daily pass with mobile money, the webhook activates it exactly once (replaying the webhook does nothing), quotas block AI processing but not capture or exporting finished records, a top-up adds reports, an upgrade carries over the balance, and receipts download correctly.

---

## 6. File map (new or changed)

```
app/
  (dashboard)/field-entry/page.tsx        # rebuilt: type/record/upload
  (dashboard)/saved-records/page.tsx      # real data
  (dashboard)/reports/page.tsx            # real finals
  (dashboard)/records/[id]/page.tsx       # detail
  (dashboard)/records/[id]/review/page.tsx# split review
  (dashboard)/insights/page.tsx           # supervisors
  (dashboard)/billing/page.tsx            # pass, meters, buy/top-up, receipts
  (dashboard)/billing/buy/page.tsx
  (dashboard)/admin/costs/page.tsx
  pricing/page.tsx
  api/encounters/…  api/sources/…  api/uploads/…  api/exports/…
  api/inngest/route.ts  api/webhooks/nylonpay/route.ts  api/billing/{checkout,payments/[reference]}/route.ts  api/stt/live-token/route.ts
components/capture/*  components/review/*  components/exports/*  components/insights/*
db/schema.ts  db/migrations/*  db/seed.ts
inngest/functions/{transcribe,extract,refine,translate,export}.ts
lib/auth.ts  lib/crypto.ts  lib/logger.ts  lib/r2.ts
lib/ai/{provider.ts,anthropic.ts,prompts/*}
lib/sunbird/{auth.ts,stt.ts,translate.ts}
lib/assemblyai/{transcribe.ts,live.ts}
lib/verify/{spans,numbers,drugs,negation}.ts
lib/privacy/pseudonymise.ts
lib/clinical/{abbreviations,keyterms}.ts
lib/offline/{db.ts,crypto.ts,outbox.ts}
lib/billing/{plans,entitlements,nylonpay,usage}.ts
inngest/functions/reconcile-payments.ts
messages/{eng,lug,nyn,swa,fra}.json
eval/fixtures/*.json  scripts/eval-refine.ts
public/fonts/NotoSans-*.ttf
PRODUCT.md  DESIGN.md  .env.example  .github/workflows/ci.yml
```

---

## 7. Tests

- **Unit (Vitest):** `lib/verify/*` (each must catch an injected invented number, drug, dropped negation and span-less line), `pseudonymise` (round trip; no PII left in the output), `crypto` (round trip; tamper detection), placeholder protection in translation, entitlement rules (extend, upgrade carry-over, top-up expiry, expired pass still exports Finals), trial-per-phone check, webhook signature + idempotency.
- **Integration:** API routes with a test DB (org isolation: cross-org and cross-worker access returns 404), the Inngest functions with mocked providers.
- **E2E (Playwright):** sign in → type → process → review → sign off → PDF; offline capture → reconnect → sync; upload a DOCX → final; a Luganda export; trial → buy Daily pass in Nylon Pay sandbox → quota reached → top-up; Trial export mark.
- **Eval:** `npm run eval:refine` must report **0 added facts** before any merge that touches prompts, models or verification.

---

## 8. Definition of done

- [ ] A worker can type, record (offline) or upload notes for an encounter.
- [ ] Originals are stored unchanged; every refined line links to its source.
- [ ] Code verification blocks invented numbers, dates, drugs and dropped negations.
- [ ] Nothing becomes Final without the worker's sign-off; edits create versions.
- [ ] English STT via AssemblyAI (Medical Mode, speakers); local languages via Sunbird; no trimmed audio.
- [ ] Exports to PDF, Word and slides in the chosen language, with identical facts; fixed labels human-translated; numbers protected.
- [ ] Slides chart only confirmed metric fields.
- [ ] Offline capture, encrypted local storage, reliable sync.
- [ ] No secrets in the repo; no patient content in logs; pseudonymisation before AI; private storage with short-lived links; MFA before production data.
- [ ] Billing: 7-day trial (one per account and phone), prepaid UGX passes (500 / 2,000 / 5,000 / 20,000 / 55,000) and top-ups via Nylon Pay mobile money, verified idempotent webhooks, receipts, team seats, cost ledger; an expired pass never blocks access to finished records.
- [ ] Every screen passed the impeccable critique → audit → adapt → harden → polish loop, using the ui-ux-pro-max design system recorded in `DESIGN.md`.
- [ ] Nothing in the UI, exports or marketing looks or reads like an AI product (Section 1.5); `check-copy` passes in CI; legal pages disclose automated processing plainly and truthfully.
- [ ] README updated: real architecture, setup, env vars and the claims the product actually meets.
