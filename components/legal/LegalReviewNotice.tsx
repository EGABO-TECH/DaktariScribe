/** Shown on every legal page until a qualified lawyer has reviewed it (spec §5 Phase 6.11). */
export default function LegalReviewNotice() {
  return (
    <p className="section-intro">
      <strong>Draft for legal review.</strong> This page describes how DaktariScribe works today. It has not yet been reviewed by a qualified lawyer and must be reviewed
      before DaktariScribe is used with real patient data.
    </p>
  );
}
