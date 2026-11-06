# DaktariScribe — Open Questions for the Owner

> These questions need product decisions from the owner. The agent will proceed with the safest default until answered.

---

## Q1. AI Provider & Data Retention
**Which speech-to-text provider(s) and LLM(s) should be used, and are data-retention/zero-retention settings needed?**

The `.env.local` references `AI_MODEL_PROVIDER=openai` and `AI_MODEL_NAME=gpt-4o`, but no AI integration exists in the code.

**Default assumed:** Will build with OpenAI API (GPT-4o for synthesis, Whisper for STT) with zero-data-retention API option enabled.

---

## Q2. Language Support at Launch
**Which languages must be supported at launch? Has any accuracy testing been done on Ugandan-accented English and local languages?**

**Default assumed:** English (primary), Swahili and Luganda (best-effort with accuracy warnings).

---

## Q3. Data Controller
**Who is the data controller for a facility using the app: the facility or DaktariScribe Ltd?**

This affects the privacy policy and PDPO registration. The current policy implies DaktariScribe is the controller.

**Default assumed:** DaktariScribe Ltd is the data controller. Will note this needs legal review.

---

## Q4. Company Legal Name & PDPO Registration
**Is the company legally "DaktariScribe Ltd"? Is PDPO registration complete?**

The Compliance page claims PDPO registration; this may or may not be true.

**Default assumed:** Not yet registered. Will soften claims to "working towards registration."

---

## Q5. Patient Name Storage
**Should patient names be stored at all, or only a local reference?**

**Default assumed:** Local reference only (e.g., `CAMP-YYMMDD-###` + age + sex). Name optional and not required.

---

## Q6. Clinical Advisor
**Is there a clinical advisor who can review templates and red-flag prompts before release?**

**Default assumed:** No clinical advisor available. Will flag AI-generated content clearly as "requires clinical review" and defer template/red-flag features to Phase 5.

---

## Q7. Product Name
**What is the canonical product name? Currently used interchangeably:**
- "DaktariScribe"
- "DaktariScribe Pharma Network"
- "DaktariScribe Clinical Network"
- "DaktariScribe Clinical Pharma Network"

**Default assumed:** "DaktariScribe" is the product name. Will unify across all pages.
