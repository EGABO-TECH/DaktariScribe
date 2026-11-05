import LegalPageLayout from "@/components/legal/LegalPageLayout";
import LegalReviewNotice from "@/components/legal/LegalReviewNotice";

export const metadata = {
  title: "Terms of Service — DaktariScribe",
  description: "Terms for using DaktariScribe, including prepaid passes.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" badge="Terms" badgeIcon="gavel" lastUpdated="5 November 2026">
      <LegalReviewNotice />

      <h2>1. The service</h2>
      <p>DaktariScribe helps health workers capture encounters by typing, voice recording or upload, organises them into records, and exports signed-off records as reports.</p>

      <h2>2. Your responsibilities</h2>
      <ul>
        <li>Obtain the respondent&rsquo;s consent for each encounter.</li>
        <li>Review every record against your original notes and sign it off only if it is accurate. Automated transcription, organising and translation can make mistakes; you remain responsible for the record.</li>
        <li>Keep your sign-in details and device PIN private.</li>
      </ul>

      <h2>3. Automated processing</h2>
      <p>Recordings and notes are processed by automated transcription and text-processing services named in the Privacy Policy. Nothing becomes final without your sign-off.</p>

      <h2>4. Prepaid passes</h2>
      <ul>
        <li>Passes are prepaid in Uganda shillings and <strong>never renew automatically</strong>.</li>
        <li>Each new account may claim one free 7-day trial, once per account and per phone number.</li>
        <li>Top-ups add to an active pass and end with it.</li>
        <li>When a pass ends you keep full access to read and export your signed-off records, and you can still capture drafts. Only new processing needs a new pass.</li>
        <li>Refunds are handled by our team on request. Mobile-money refunds are possible from UGX 5,000; smaller amounts are returned as account credit.</li>
      </ul>

      <h2>5. Your data</h2>
      <p>You and your organisation own your records. We never sell or share patient data. See the Privacy Policy.</p>

      <h2>6. Availability</h2>
      <p>We work to keep the service available but cannot guarantee it will be uninterrupted. Notes captured on your device are kept there until they upload.</p>

      <h2>7. Contact</h2>
      <p>DaktariScribe · hello@daktariscribe.com</p>
    </LegalPageLayout>
  );
}
