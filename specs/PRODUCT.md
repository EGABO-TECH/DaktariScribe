# DaktariScribe — Product context

> Written by hand from `DAKTARISCRIBE_BUILD_SPEC.md` §1.2 because the `impeccable` and
> `ui-ux-pro-max` skills were not installed in the build environment. Re-run
> `/impeccable init` once they are available and reconcile with this file.

## What it is

DaktariScribe is a clinical documentation tool for healthcare practitioners and field
workers in Uganda and East Africa. A worker captures an encounter by **typing**,
**recording** a voice interview, or **uploading** what they wrote (photos of handwriting,
PDF, Word, Excel/CSV). The system tidies that material into a clean, structured record
**without adding or changing anything**. The worker reviews it and signs it off, then
exports it as a PDF report, a Word document or a slide deck of the metrics, in the
language they choose.

**The software is the clerk; the clinician is the author.**

## Who uses it, and where

- Clinicians, nurses, community health workers, enumerators and supervisors.
- Mid-range Android phones and laptops.
- Often outdoors, in bright light, with weak or no internet, sometimes wearing gloves,
  often mid-interview with a patient.

## Priorities (in order)

1. **Speed of capture.** Opening the app to typing must take seconds. Large controls.
2. **Legibility.** High contrast (≥ 4.5:1), no light-grey body text, readable in sunlight.
3. **Trust.** Clinical seriousness, not playful. Looks like a well-made official records
   system or modern EMR.
4. **Accessibility.** WCAG 2.2 AA. Touch targets ≥ 48 × 48 px. Colour is never the only signal.
5. **Offline clarity.** Always show what is saved on the device and what is pending.
6. **Presentable exports.** Print-quality reports that look like they came from a health
   organisation.

## Non-negotiables (from spec §0.2)

- Never invent clinical content. Originals are immutable.
- No secrets in code; no patient content in logs.
- No patient data to services that train on it.
- Offline first for capture.
- **It must not look or read like an AI product** (see `DESIGN.md` → "No AI look").

## Voice and tone

Plain, professional, action-led. Short labels. Verbs a clerk would use:
*Save draft · Process · Organise notes · Prepare report · Review · Sign off · Export.*

Honest about automated processing where people need to know (legal pages, sub-processor
list), in plain words such as "automated transcription", never as hype.
