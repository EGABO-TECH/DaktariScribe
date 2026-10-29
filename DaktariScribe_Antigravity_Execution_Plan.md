# DaktariScribe — Audit, Fixes & Enhancements
### Execution spec for Google Antigravity

**Product:** DaktariScribe — voice-first and text medical scribe for frontline health outreach (field medics, camp-based clinics, low connectivity).
**Live app:** https://daktariscribe.vercel.app/
**Repo:** https://github.com/EGABO-TECH/DaktariScribe.git
**Owner:** Egabo Aaron (EGABO-TECH)

---

## 0. How to use this file (read first)

You are the executing agent. This document is a **spec plus a task list**.

**Hard rule — do not change the product idea.** DaktariScribe stays what it is: *capture an encounter by voice or text in the field, group it by title and camp location, run an AI synthesis pipeline that stabilises clinical jargon, and export a clinician-ready PDF.* Every change below makes that loop safer, faster, more reliable offline, or clearer. Do not add unrelated features, rebrand, or swap the core concept.

**Evidence levels used in this document**

| Tag | Meaning |
|---|---|
| `[OBSERVED]` | Seen directly on the public pages (landing/login, register, forgot-password, privacy, security, compliance). |
| `[CLAIMED]` | The product's own legal/marketing pages say it. It may or may not be implemented. |
| `[VERIFY]` | A likely problem inferred from the stack and the product type. **Confirm in the code before changing anything.** |

The authenticated screens (dashboard, recorder, encounter editor, PDF export) were not visible to the author of this document, and the repo could not be read. So **Phase 0 is mandatory**: audit the real code, then confirm or discard every `[VERIFY]` item. If something here contradicts the code, the code wins. Record the discrepancy in `docs/AUDIT_FINDINGS.md`.

**Working rules for the agent**

1. Work on a branch per phase: `fix/phase-1-safety`, `feat/phase-3-offline`, etc.
2. One task = one commit. Message format: `type(scope): summary [TASK-ID]`.
3. After each task, run lint, typecheck, tests and a production build. Do not move on if red.
4. Never log, commit or hard-code PHI, API keys or secrets. Use environment variables. Add a `.env.example`.
5. If a task needs a product decision, write the question in `docs/OPEN_QUESTIONS.md` and continue with the safest default.
6. Prefer small, reversible changes. Add a feature flag for anything risky.

---

## 1. What the public surface shows (`[OBSERVED]`)

- **Stack hints:** Next.js (image optimiser paths `/_next/image`), hosted on Vercel, Material Symbols icon font (icon names render as plain text when the font fails: `clinical_notes`, `smart_toy`, `picture_as_pdf`).
- **Landing = login.** The root URL is a combined hero + sign-in card. Sign-in: Google, or email + password, "Forgot?", link to register.
- **Four value cards:** Capture in Field (dictate audio or type findings with minimal connectivity), Modular Templates (name and group encounters locally by title and camp location), AI Synthesis (multi-model pipeline stabilises jargon and aggregates findings), PDF Reports.
- **Trust badges:** Encrypted · Offline-Ready · Clinician-Vetted.
- **Register:** first name, last name, email, password, confirm, one checkbox (Terms + Privacy + "AI outputs must be validated by a licensed clinician").
- **Forgot password:** email → "Send Reset Code".
- **Legal pages:** Privacy, Terms, Compliance, Security — long, detailed, dated 1 August 2026.

---

## 2. Findings (faults, risks, gaps)

Severity: **S1** critical (safety, legal, data loss) · **S2** high · **S3** medium · **S4** low/polish.

### 2.1 Clinical safety & AI output

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| F-01 | S1 | **No visible human-review gate.** The legal pages say human-in-the-loop validation is mandatory before AI output enters records. Nothing on the public flow shows a mandatory review/approve step before PDF export. A PDF that looks "clinician-ready" but was never reviewed is a patient-safety risk. | `[CLAIMED]` + `[VERIFY]` |
| F-02 | S1 | **Hallucination and silent rewriting risk.** "Stabilises jargon" and "aggregates findings" means the model rewrites clinician speech. Without source-linking, a changed drug name, dose or negation ("no fever" → "fever") is undetectable. | `[VERIFY]` |
| F-03 | S1 | **Drug/dose/allergy/vitals errors are the highest-harm class.** Speech-to-text commonly confuses similar-sounding drugs and numbers. No evidence of entity highlighting, unit validation or confirm-before-save for these fields. | `[VERIFY]` |
| F-04 | S2 | **Language coverage is unclear.** "Daktari" is Swahili; field work in Uganda mixes English with Luganda, Runyankole, Acholi, Ateso, Swahili, plus code-switching. No language selector or per-language accuracy warning is visible. | `[OBSERVED]` (absence) |
| F-05 | S2 | **No patient-consent capture for recording.** Voice audio of a patient encounter is recorded; there is no visible consent step or consent record in the encounter. | `[VERIFY]` |
| F-06 | S2 | **Outputs have no confidence/uncertainty signalling.** Low-confidence transcript spans are not flagged for the clinician. | `[VERIFY]` |

### 2.2 Security, privacy & legal-claim accuracy

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| F-07 | S1 | **Over-claiming risk on legal pages.** The Security/Compliance/Privacy pages state HSM-managed keys, client-side per-session audio encryption, AES-256 encrypted offline store, remote device wipe, mandatory MFA for admins, 30-minute session expiry, PAM bastion hosts, annual third-party penetration tests, ISO/IEC 27001 audits, "registered with the PDPO", a Security Hall of Fame, HIPAA framework alignment. For a Vercel-hosted early product, **every untrue claim is a legal and trust liability** (misrepresentation, regulatory exposure). | `[CLAIMED]` |
| F-08 | S1 | **Claims vs. implementation must be reconciled.** Each claim above must be either implemented and evidenced, or removed/softened to what is true today (see TASK-1.4). | `[VERIFY]` |
| F-09 | S2 | **Retention conflict.** Clinical data is "retained a minimum of 7 years" while erasure is promised "where legal obligation doesn't require retention". The policy does not tell a field worker what happens to *device-local* data, or who the data controller is when a facility uses the app (facility vs. DaktariScribe). | `[OBSERVED]` |
| F-10 | S2 | **Audio retention is unspecified.** Raw audio is far more sensitive and larger than text. The policy lumps audio with notes. Best practice: delete audio after successful transcription + review, unless the facility opts in. | `[OBSERVED]` (absence) |
| F-11 | S2 | **Auth hardening unknown.** No visible password-strength rules, rate limiting, lockout, email verification step, or MFA enrolment on the register flow. "Send Reset Code" suggests a code-based reset: code length, expiry and attempt limits are unknown. | `[VERIFY]` |
| F-12 | S2 | **Register collects no professional identity.** No role (clinician / supervisor / facility admin), facility, camp, licence/registration number, or phone. The Security page defines roles (Clinician, Supervisor, Facility Admin, System Admin) that the sign-up cannot assign. | `[OBSERVED]` |
| F-13 | S2 | **Google sign-in appears on Login but not on Register.** Inconsistent entry paths; unclear how a Google user completes the missing profile/role/terms-consent. | `[OBSERVED]` |
| F-14 | S3 | **Consent is a single bundled checkbox** (Terms + Privacy + AI-validation acknowledgement). Optional analytics/model-improvement consent is described as "explicit opt-in" but no separate control is visible. | `[OBSERVED]` |
| F-15 | S2 | **Standard web-security headers/CSP unverified.** `[VERIFY]` CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy (microphone must be allowed only for self), cookie flags (`HttpOnly`, `Secure`, `SameSite`). |  `[VERIFY]` |
| F-16 | S2 | **Per-user data isolation unverified.** If Supabase/Firebase/Postgres is used, row-level security / security rules must guarantee a user can only read their own (or their facility's) encounters. | `[VERIFY]` |
| F-17 | S2 | **AI provider keys and prompts.** Confirm model API calls happen server-side only, keys are never shipped to the browser, PHI is minimised/redacted in prompts, and provider zero-retention settings are used. | `[VERIFY]` |

### 2.3 Offline & field reliability

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| F-18 | S1 | **"Offline-Ready" badge and "minimal internet connectivity" copy** promise offline capture. A Next.js app on Vercel is not offline-capable by default: it needs a service worker, an app-shell cache, local persistent storage (IndexedDB) and a sync queue. If these are missing, the badge is false and field data can be lost when the signal drops mid-encounter. | `[CLAIMED]` + `[VERIFY]` |
| F-19 | S1 | **Recording-loss risk.** Long dictations held only in memory are lost on tab crash, battery death, or accidental navigation. Need chunked, incremental persistence of audio while recording. | `[VERIFY]` |
| F-20 | S2 | **AI synthesis requires connectivity** (multi-model pipeline). There is no visible "queued — will process when online" state, retries with backoff, or partial results. | `[VERIFY]` |
| F-21 | S2 | **Sync conflicts.** Same encounter edited on two devices, or edited offline then synced: need defined conflict policy and visible sync status per encounter. | `[VERIFY]` |
| F-22 | S3 | **Low-end device performance.** Heavy hero imagery/animation and large JS bundles hurt on low-spec Android phones and 2G/3G. | `[VERIFY]` |
| F-23 | S3 | **Microphone permission handling.** Denied/blocked permission, no mic, Bluetooth headset switching, and iOS Safari recording quirks need explicit UX. | `[VERIFY]` |

### 2.4 UI / UX

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| F-24 | S3 | **Naming inconsistency.** The register page says "DaktariScribe **Pharma** Network"; the landing/login footer says "Clinical Network" and then "Clinical **Pharma** Network" in a second footer. "Pharma" misleads (this is a clinical documentation tool, not a pharmaceutical company). Pick one name. | `[OBSERVED]` |
| F-25 | S3 | **Duplicate footers/copyright lines** on the landing page with different company names. | `[OBSERVED]` |
| F-26 | S3 | **Icon-font dependency.** Icon names appear as raw text (`mic`, `folder_open`, `lock visibility`, `arrow_forward`) when the Material Symbols font is blocked or slow, which is common on poor networks. Self-host the font subset or use inline SVG. | `[OBSERVED]` |
| F-27 | S3 | **Marketing and auth are fused on one screen.** First-time visitors and returning field workers share one view; on a small phone the hero pushes the login card below the fold (`[VERIFY]` on real devices). | `[OBSERVED]` |
| F-28 | S3 | **Tagline typo/ambiguity:** "dictate audio or type **medication findings**" reads as medication-only. The product captures full encounters (history, exam, assessment, plan). | `[OBSERVED]` |
| F-29 | S3 | **Accessibility unverified.** Contrast on dark navy theme (#0d2240), focus rings, form labels/ARIA on the password visibility toggles, error announcements, minimum 44px touch targets, outdoor-sunlight legibility. | `[VERIFY]` |
| F-30 | S3 | **Form UX.** Register has no visible inline validation, password requirements, or show-rules; the 5-field form is split into "Primary Identity" and "Security & Access" (good) but gives no progress/feedback. | `[OBSERVED]` |
| F-31 | S3 | **"Clinician-Vetted" badge** is a trust claim with no explanation or evidence (who vetted what, when). | `[OBSERVED]` |
| F-32 | S4 | **Reset-code flow** has no visible "check your email", resend timer, or code-entry step on the page (`[VERIFY]` after submit). | `[OBSERVED]` |
| F-33 | S4 | **No in-app language switch (English/Swahili/Luganda UI).** | `[OBSERVED]` (absence) |

### 2.5 Data model, export & workflow

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| F-34 | S2 | **Unstructured output.** "Clinician-ready" notes should follow a standard structure (SOAP: Subjective, Objective, Assessment, Plan) with discrete fields for allergies, current medications, vitals, referrals. | `[VERIFY]` |
| F-35 | S2 | **Patient identification.** Without a safe patient identifier scheme (local ID, age/sex, no unnecessary names), encounters can be mixed up, or PHI over-collected. | `[VERIFY]` |
| F-36 | S2 | **PDF integrity.** Exported PDFs need: clinician name/ID, facility/camp, date-time, version, "AI-assisted, reviewed by" statement, and a tamper-evident footer (hash/QR). Unicode (Swahili/Luganda diacritics) must render correctly. | `[VERIFY]` |
| F-37 | S3 | **No audit trail** of who changed what between transcript, AI draft and final note. Required for clinical documentation defensibility. | `[VERIFY]` |
| F-38 | S3 | **Encounter grouping** is by "title and camp location" only. Needs search, filter by date/camp/status (Draft · Needs review · Reviewed · Exported), and bulk export. | `[CLAIMED]` |
| F-39 | S3 | **No error taxonomy.** Network, quota, transcription-failed and model-failed states need distinct, plain-language messages and a retry action. | `[VERIFY]` |
| F-40 | S4 | **No analytics for reliability** (privacy-safe): failure rates of transcription/synthesis, sync lag, PDF failures. | `[VERIFY]` |

---

## 3. Execution plan

Do the phases in order. Within a phase, follow the task order.

### PHASE 0 — Audit the real code (no feature changes)

**Goal:** turn every `[VERIFY]` into `CONFIRMED` / `NOT AN ISSUE`, and map the real architecture.

- **TASK-0.1 — Map the repo.** Produce `docs/ARCHITECTURE.md`: framework + version, routing (App vs Pages router), auth provider, database/storage, AI provider SDKs, PDF library, speech-to-text path, state management, PWA/service-worker status, environment variables (names only), deployment config (`vercel.json`, headers).
- **TASK-0.2 — Trace the encounter lifecycle.** Document, as a sequence: sign-in → create encounter (title, camp) → capture (voice/text) → storage → transcription → AI synthesis (each model's role and prompt) → edit/review → PDF → download/share → delete. Draw it as a Mermaid diagram in `docs/WORKFLOW.md`.
- **TASK-0.3 — Run the toolchain.** Install, lint, typecheck, test, build. Record failures and warnings in `docs/AUDIT_FINDINGS.md`.
- **TASK-0.4 — Security scan.** Search the code and git history for committed secrets; run `npm audit`; review auth/session handling, API route protection, and database access rules (RLS/security rules). List each F-11, F-15, F-16, F-17 as confirmed/not.
- **TASK-0.5 — Offline check.** Inspect for service worker, manifest, IndexedDB usage, background sync. Test in DevTools (Offline + Slow 3G) and record what breaks (F-18–F-21).
- **TASK-0.6 — Lighthouse + a11y.** Run Lighthouse (mobile) on `/`, `/register`, and the main authenticated screens; run axe. Save scores.
- **TASK-0.7 — Findings reconciliation.** Update this file's finding table: mark each ID `CONFIRMED`, `NOT AN ISSUE`, or `NEW`. Add any new faults discovered.

**Exit criteria:** `docs/ARCHITECTURE.md`, `docs/WORKFLOW.md`, `docs/AUDIT_FINDINGS.md` committed; no source changes yet.

---

### PHASE 1 — Safety, honesty & security (do before any new features)

**TASK-1.1 — Mandatory review gate (F-01).**
Add an encounter status machine: `DRAFT → NEEDS_REVIEW → REVIEWED → EXPORTED`. PDF export is **disabled** until status is `REVIEWED`. "Mark as reviewed" requires the clinician to confirm via a checkbox ("I have reviewed and take responsibility for this note"). Store reviewer ID and timestamp.
*Acceptance:* cannot export an unreviewed note via UI or direct API call (server-side enforced); test covers both.

**TASK-1.2 — Source-linked AI output (F-02, F-06).**
Show the raw transcript next to the synthesised note. Each synthesised sentence links back to its source span in the transcript. Highlight any synthesised content that has **no** supporting span as "Not found in dictation — verify". Highlight low-confidence transcript words if the STT provider returns confidences.
*Acceptance:* clinician can click any note line and see its source; unsupported lines are visibly flagged.

**TASK-1.3 — High-risk entity check (F-03).**
Detect drugs, doses, units, routes, allergies, vitals and negations in the draft. Render them as editable chips. Require explicit confirmation for: any drug+dose, any allergy, any vital sign outside plausible range (configurable table), any negation flip between transcript and note. Add a unit-normalisation helper and unit tests (mg vs mcg, mL, °C vs °F).
*Acceptance:* a draft with unconfirmed high-risk entities stays in `NEEDS_REVIEW`; unit tests include similar-sounding drug names and number-word dictation.

**TASK-1.4 — Make legal/security claims truthful (F-07, F-08, F-24, F-25).**
Build `docs/CLAIMS_MATRIX.md`: one row per claim on Privacy, Security, Compliance and landing page → `Implemented (evidence)` / `Partially` / `Not implemented`. Then edit the public pages so they state **only what is true today**. Replace unverified claims (HSM, ISO audits, "registered with PDPO", pentests, hall of fame, remote wipe, mandatory admin MFA, HIPAA alignment, etc.) with accurate language such as "we are working towards…" or remove them. Keep a `LEGAL_REVIEW_NEEDED.md` note for the owner to have a Ugandan lawyer review the final text. Unify the product/company name across all pages (suggest **DaktariScribe**; drop "Pharma" unless the company is legally named that).
*Acceptance:* every sentence in the legal pages maps to a row in the matrix marked Implemented or is reworded as a roadmap statement.

**TASK-1.5 — Authentication hardening (F-11, F-13).**
Enforce password policy (min length 12, breached-password check if available), email verification before first use, rate limiting + progressive lockout on login/reset, reset codes ≥ 8 digits or signed single-use links with 15-minute expiry and attempt limits, generic error messages (no account enumeration), secure session cookies, 30-minute idle timeout (matches the stated policy), optional TOTP MFA with recovery codes. Make Google sign-in available on both Login and Register and route first-time Google users through a "Complete profile" step (role, facility, consent).
*Acceptance:* automated tests for lockout, reset expiry, and enumeration resistance.

**TASK-1.6 — Web security baseline (F-15).**
Add security headers in `next.config` / `vercel.json`: CSP (tight, nonce-based if feasible), HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: microphone=(self), camera=(), geolocation=()`, frame-ancestors none. Verify cookie flags.
*Acceptance:* securityheaders.com-style scan returns A-level; mic still works.

**TASK-1.7 — Data isolation & API protection (F-16, F-17).**
Enforce per-user / per-facility access at the database layer (RLS or equivalent) and in every API route. Move all AI calls server-side; add input size limits, per-user rate limits, and request validation (zod). Redact direct identifiers from prompts where possible; set provider zero-data-retention options. Add tests proving user A cannot read user B's encounters.
*Acceptance:* automated cross-tenant access test fails closed.

**TASK-1.8 — Consent & retention controls (F-05, F-09, F-10, F-14).**
Add a **patient consent step** before recording starts (verbal-consent checkbox + optional language note), stored on the encounter. Split registration consent into separate controls: Terms/Privacy (required), AI-validation acknowledgement (required), analytics/model-improvement (optional, off by default). Implement audio retention: delete raw audio after successful transcription and review unless the facility opts in; show a retention line in the encounter. Add "Delete my data / export my data" in settings, wired to the stated 21-day PDPA response window.
*Acceptance:* recording cannot start without the consent tick; audio deletion job tested.

**Phase 1 exit criteria:** TASK-1.1 to 1.8 merged; test suite green; `CLAIMS_MATRIX.md` complete.

---

### PHASE 2 — Core workflow quality

**TASK-2.1 — Structured note schema (F-34).**
Introduce a typed schema (zod + TypeScript): `Encounter { id, title, campLocation, patientRef, ageYears, sex, chiefComplaint, history, vitals[], examination, assessment, plan, medications[], allergies[], referrals[], followUp, language, consent, status, createdBy, reviewedBy, timestamps }`. The AI pipeline must return JSON validated against this schema; invalid output triggers one automatic repair attempt and then a clear error. Present the note as editable SOAP sections plus structured fields. Keep free-text fallback so nothing about the original "type or dictate" idea is lost.
*Acceptance:* schema validation on every AI response; unit tests with malformed outputs.

**TASK-2.2 — Safer patient reference (F-35).**
Default to a local patient reference (e.g., `CAMP-YYMMDD-###`) plus age and sex; make name optional. Add a duplicate-warning when a similar reference and age appear in the same camp/day.
*Acceptance:* encounters can be created without a patient name.

**TASK-2.3 — Language support (F-04, F-33).**
Add a "Dictation language" selector (English, Swahili, Luganda, and a "Mixed / unsure" option). Be honest in the UI: show an accuracy notice for languages with weaker speech-recognition support and force the review gate. Preserve original-language transcript and generate the English clinical note alongside it. Add UI translation scaffolding (i18n, start with English + Swahili strings).
*Acceptance:* language stored per encounter; note shows both original transcript and English note.

**TASK-2.4 — Encounter list, search & states (F-38).**
Add search, filters (date range, camp, status, clinician), sort, and status badges (Draft · Needs review · Reviewed · Exported · Sync pending). Add bulk export of reviewed encounters as a ZIP of PDFs. Add "camp templates" (saved camp name, default language, default clinician) to speed up repeated entry — this is the existing "Modular Templates" idea, made reusable.
*Acceptance:* list handles 1,000 encounters smoothly (virtualised list).

**TASK-2.5 — PDF report upgrade (F-36).**
Use a PDF pipeline with embedded Unicode fonts (Noto Sans) so Swahili/Luganda diacritics render. Header: facility/camp, clinician name and registration number, date-time, encounter ID. Footer: "AI-assisted draft reviewed by {name} at {time}", page numbers, version, and a short integrity hash + QR code linking to a verification page. Include allergies and medications in a boxed section at the top. Add a "patient-handout" variant in plain language.
*Acceptance:* PDF renders correctly with sample Luganda/Swahili text; hash verification page works.

**TASK-2.6 — Audit trail (F-37).**
Append-only `encounter_events` table (created, transcribed, synthesised, edited-field, reviewed, exported, deleted) with actor and timestamp. Show a read-only "History" drawer in the encounter. Never store raw PHI in event payloads beyond field names and hashes where possible.
*Acceptance:* every state change produces an event; events cannot be updated or deleted by clients.

**TASK-2.7 — Error handling taxonomy (F-39).**
Define typed error codes (`NETWORK_OFFLINE`, `STT_FAILED`, `LLM_TIMEOUT`, `QUOTA_EXCEEDED`, `SCHEMA_INVALID`, `PDF_FAILED`, `AUTH_EXPIRED`). Map each to a plain-language message and a primary action (Retry / Save draft / Continue offline). Add error boundaries so one failing panel never blanks the page.
*Acceptance:* each error code has a unit test and a UI state.

---

### PHASE 3 — True offline-first (F-18 to F-23)

**TASK-3.1 — PWA foundation.**
Add a web app manifest, icons, `display: standalone`, and a service worker (Workbox or Serwist) with an app-shell strategy, runtime caching for static assets, and an offline fallback page. Show an install prompt.
*Acceptance:* Lighthouse PWA/installable checks pass; app shell loads in airplane mode after first visit.

**TASK-3.2 — Local encrypted store.**
Use IndexedDB (Dexie) for encounters, audio chunks and the sync queue. Encrypt sensitive payloads with WebCrypto AES-GCM using a key derived from the user's credentials/PIN (document key handling honestly). Add an optional app-lock PIN.
*Acceptance:* data survives reload and browser restart; plaintext PHI not visible in IndexedDB inspection.

**TASK-3.3 — Crash-safe recording (F-19).**
Record with `MediaRecorder` in timeslices (e.g., every 5 s) and persist each chunk immediately. On reopening, detect an interrupted recording and offer "Recover recording". Add a live level meter, elapsed time, pause/resume, and a wake-lock to keep the screen on. Warn at low storage/battery where the API allows.
*Acceptance:* killing the tab mid-recording loses at most the final chunk; recovery flow tested.

**TASK-3.4 — Sync queue & status (F-20, F-21).**
Queue uploads, transcription and synthesis jobs with exponential backoff and idempotency keys. Per-encounter sync badge (Local only · Syncing · Synced · Failed — retry). Conflict policy: last-writer-wins on non-clinical metadata; for clinical text, keep both versions and prompt the clinician to pick/merge. Use the Background Sync API where available, with a foreground fallback.
*Acceptance:* airplane-mode test: create, dictate, edit offline → reconnect → everything syncs once, no duplicates.

**TASK-3.5 — Offline typing path.**
Text entry must work with zero connectivity (including SOAP form editing). Synthesis shows "Queued — will run when online" and offers a local template-based draft so the clinician still has a usable note.
*Acceptance:* a complete text encounter can be created and saved offline.

**TASK-3.6 — Microphone UX (F-23).**
Pre-flight check screen: permission state, input device, level test. Clear recovery instructions for blocked permissions (per browser), and automatic fallback to typing.
*Acceptance:* denied-permission and no-device paths covered by tests/manual script.

**TASK-3.7 — Make the "Offline-Ready" claim true (F-18).**
After 3.1–3.6 are verified, keep the badge and link it to a short "What works offline" explainer. Until then, change the badge to "Offline mode — coming soon" (or remove it).
*Acceptance:* every offline claim on the site is demonstrably true.

---

### PHASE 4 — UI/UX polish (F-22, F-24 to F-33)

**TASK-4.1 — Split marketing from sign-in.**
Landing (`/`) = concise value proposition + clear "Sign in" / "Create account" buttons. Move the form to `/login`. Authenticated users hitting `/` redirect to the dashboard. On phones, the login form must be visible without scrolling.

**TASK-4.2 — Fix copy & naming (F-24, F-25, F-28, F-31).**
Single brand name; remove the duplicate footer; reword "type medication findings" to "type or dictate your encounter notes"; replace "Clinician-Vetted" with a specific, true statement (e.g., "Every note is reviewed by a clinician before export") or remove it.

**TASK-4.3 — Self-host icons and fonts (F-26).**
Replace the Material Symbols web font with inline SVG icons (or a self-hosted subset). Use `next/font` for text fonts with `display: swap`. Verify nothing shows raw icon names on a throttled connection.

**TASK-4.4 — Registration UX (F-12, F-30).**
Multi-step form: (1) Identity (name, email, phone), (2) Professional (role, facility, registration number — optional but encouraged), (3) Security (password with live strength meter and rule checklist). Inline validation, accessible error messages, and a clear final consent block with separate checkboxes (see TASK-1.8).

**TASK-4.5 — Reset flow (F-32).**
Add the code-entry step with resend countdown, masked email, expiry messaging, and a success screen that explains next steps.

**TASK-4.6 — Field-first design system.**
High-contrast theme tested for outdoor sunlight, large touch targets (≥ 48 px), one-thumb layout for the recorder (big record/stop button at the bottom), haptic/sound cue on start/stop, dark and light modes, respect `prefers-reduced-motion`.

**TASK-4.7 — Accessibility pass (F-29).**
Fix contrast (WCAG AA), visible focus states, labels and `aria-pressed` on password toggles, `aria-live` regions for errors/sync status, keyboard navigation, and screen-reader names for icon buttons. Run axe in CI.

**TASK-4.8 — Performance on weak networks (F-22).**
Budget: landing < 150 KB JS gzipped, LCP < 2.5 s on Slow 4G emulation. Optimise/remove hero imagery, code-split the recorder and PDF libraries, lazy-load below-the-fold content.

**TASK-4.9 — Onboarding.**
A 3-screen first-run tour (Create encounter → Record or type → Review & export) with a sample encounter pre-loaded in demo mode (no real patient data).

---

### PHASE 5 — Additions that strengthen the original idea

These stay inside the "capture → synthesise → report" loop.

| ID | Addition | Why |
|---|---|---|
| A-01 | **Voice commands during dictation** ("new section: assessment", "undo last sentence") | Hands-free use with gloves/in the field. |
| A-02 | **Quick-insert templates** (common presentations: malaria, respiratory infection, antenatal visit, wound care, immunisation) | Faster, more complete notes; fits "Modular Templates". |
| A-03 | **Medication dictionary with autocomplete** (local formulary, brand ↔ generic) | Reduces F-03 errors; works offline. |
| A-04 | **Red-flag prompts** (e.g., danger signs in children, pregnancy complications) shown as *reminders to the clinician*, never as diagnosis | Safety net; must be clearly labelled as prompts, reviewed by clinicians before shipping. |
| A-05 | **Supervisor review queue** (role-based) | Matches the roles already described in the Security page. |
| A-06 | **Facility/camp summary report** (counts, common complaints, referrals; de-identified) | Outreach reporting without extra tools. |
| A-07 | **Share/export options**: PDF, print, copy-as-text, share-sheet; optional referral letter | Practical field handoff. |
| A-08 | **Data-saver mode** (lower audio bitrate, deferred sync on Wi-Fi) | Cost and bandwidth in low-connectivity areas. |
| A-09 | **Admin dashboard**: user list, role assignment, session revocation, audit export | Makes the Security-page promises real. |
| A-10 | **Feedback button on every AI note** ("wrong/unsafe/helpful") feeding a private evaluation set | Supports the quarterly model-evaluation claim honestly. |

Implement A-01 to A-04 first; treat the rest as backlog unless the owner prioritises them.

---

### PHASE 6 — Quality gates, CI & observability

- **TASK-6.1 — Tests.** Unit tests (schema, unit conversion, status machine), integration tests (API routes, auth), e2e tests with Playwright (sign-up → create → record (mocked mic) → review → export; offline scenario). Target ≥ 80% coverage on `lib/` and API code.
- **TASK-6.2 — CI.** GitHub Actions: install, lint, typecheck, test, build, `npm audit`, Lighthouse CI, axe, secret scan. Block merge on failure. Add Dependabot.
- **TASK-6.3 — AI evaluation harness.** A folder of synthetic (non-real) dictation samples with expected structured output; script to score extraction accuracy for drugs, doses, vitals, negations and per-language performance. Run on each prompt/model change. Never use real patient data.
- **TASK-6.4 — Observability.** Privacy-safe error tracking (Sentry with PHI scrubbing), structured logs with no transcript content, uptime check, and basic product metrics (sync failure rate, STT failure rate, time-to-review).
- **TASK-6.5 — Docs.** `README.md` (setup, env vars, scripts), `docs/OFFLINE.md`, `docs/AI_PIPELINE.md` (models, prompts, guardrails, limitations), `docs/SECURITY.md` (true controls only), `CONTRIBUTING.md`.

---

## 4. Definition of done (whole project)

1. No S1 or S2 finding remains open (each `CONFIRMED` item fixed or consciously accepted in writing).
2. A clinician **cannot** export an unreviewed note; high-risk entities are confirmed before review.
3. Every public claim (security, compliance, offline, "clinician-vetted") is true and mapped in `CLAIMS_MATRIX.md`.
4. A full encounter can be created, dictated or typed, saved and edited with **no connectivity**, then synced without loss or duplication.
5. Recording survives tab crash and low battery with at most one chunk lost.
6. Cross-user data access is impossible (tested).
7. Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95, PWA installable.
8. CI is green; docs are current.
9. The original idea is intact: voice/text capture → templates by title + camp → AI synthesis → clinician-ready PDF.

## 5. Open questions for the owner (answer when convenient)

1. Which speech-to-text provider(s) and LLM(s) are used today, and are any data-retention/zero-retention settings enabled?
2. Which languages must be supported at launch, and has any accuracy testing been done on Ugandan-accented English and local languages?
3. Who is the data controller for a facility using the app: the facility or DaktariScribe Ltd? (Affects the privacy policy and PDPO registration.)
4. Is the company legally "DaktariScribe Ltd", and is PDPO registration complete? (Affects what the Compliance page may say.)
5. Should patient names be stored at all, or only a local reference?
6. Is there a clinical advisor who can review templates and red-flag prompts before release?

## 6. Priority order if time is short

1. TASK-0.x (audit) → 2. TASK-1.1, 1.2, 1.3 (review gate, source links, high-risk checks) → 3. TASK-1.4 (truthful claims) → 4. TASK-1.5–1.7 (auth, headers, isolation) → 5. TASK-3.2–3.4 (offline store, crash-safe recording, sync) → 6. TASK-2.1, 2.5 (schema, PDF) → 7. Phase 4 polish → 8. Phase 5 additions.

*End of spec.*
