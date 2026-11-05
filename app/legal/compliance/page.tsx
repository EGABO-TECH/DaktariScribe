import LegalPageLayout from "@/components/legal/LegalPageLayout";
import LegalReviewNotice from "@/components/legal/LegalReviewNotice";

export const metadata = {
  title: "Compliance — DaktariScribe",
  description: "How DaktariScribe supports compliance with Uganda's Data Protection and Privacy Act, 2019.",
};

export default function CompliancePage() {
  return (
    <LegalPageLayout title="Compliance" badge="Compliance" badgeIcon="verified_user" lastUpdated="5 November 2026">
      <LegalReviewNotice />

      <h2>Uganda Data Protection and Privacy Act, 2019</h2>
      <p>The software supports the Act&rsquo;s principles as follows. Registration with the Personal Data Protection Office is in progress and not yet complete.</p>
      <ul>
        <li><strong>Consent:</strong> a record cannot be saved without confirming consent for that encounter.</li>
        <li><strong>Data minimisation:</strong> we ask for a local respondent reference rather than a name.</li>
        <li><strong>Security safeguards:</strong> see the Security page.</li>
        <li><strong>Accountability:</strong> an audit log records who viewed, changed, signed off and exported each record.</li>
        <li><strong>Accuracy:</strong> originals are kept unchanged; every organised line links back to the original; the health worker reviews and signs off every record.</li>
      </ul>

      <h2>Clinical responsibility</h2>
      <p>
        DaktariScribe is a documentation tool. It does not diagnose or recommend treatment. Automated processing only organises, transcribes or translates what the health
        worker captured, and code checks flag anything that is not in the original. The signing health worker is responsible for the content of each record.
      </p>

      <h2>Data controller</h2>
      <p>The organisation using DaktariScribe decides how its records are used. Whether DaktariScribe acts as a data processor or controller for each customer will be set out in a data processing agreement after legal review.</p>
    </LegalPageLayout>
  );
}
