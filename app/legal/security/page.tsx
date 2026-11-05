import LegalPageLayout from "@/components/legal/LegalPageLayout";
import LegalReviewNotice from "@/components/legal/LegalReviewNotice";

export const metadata = {
  title: "Security — DaktariScribe",
  description: "The security measures DaktariScribe has in place today.",
};

export default function SecurityPage() {
  return (
    <LegalPageLayout title="Security" badge="Security" badgeIcon="lock" lastUpdated="5 November 2026">
      <LegalReviewNotice />
      <p>This page lists the measures that are implemented today. Items that are planned are marked as such.</p>

      <h2>In place</h2>
      <ul>
        <li><strong>Encryption at rest:</strong> note text, record content, respondent references and stored files are encrypted with AES-256-GCM (a random IV per value, versioned keys) before storage.</li>
        <li><strong>Encryption on the device:</strong> offline drafts, recordings and files are encrypted with a key derived from the worker&rsquo;s PIN (PBKDF2, 310,000 iterations). The device locks after 10 minutes and is wiped on sign-out.</li>
        <li><strong>Encryption in transit:</strong> HTTPS only, with HSTS.</li>
        <li><strong>Access control:</strong> every query is limited to the user&rsquo;s organisation; workers see only their own records. Records outside your scope behave as if they do not exist.</li>
        <li><strong>Files:</strong> stored privately and only served through signed-in, organisation-checked requests; there are no public links.</li>
        <li><strong>Browser protections:</strong> a strict Content Security Policy with per-request nonces, no third-party analytics, framing blocked, microphone limited to this site.</li>
        <li><strong>Input checks and rate limits</strong> on every API route; error messages do not reveal internal details.</li>
        <li><strong>Pseudonymisation</strong> of names, phone numbers, ID numbers and emails before text is sent to automated processing services.</li>
        <li><strong>Logging</strong> without note content, and an audit log of views, edits, sign-offs, exports and payments.</li>
        <li><strong>Payments:</strong> webhook signatures are verified and each payment activates a pass exactly once.</li>
        <li><strong>Development:</strong> automated checks for leaked secrets and vulnerable dependencies on every change.</li>
      </ul>

      <h2>Planned before use with real patient data</h2>
      <ul>
        <li>Multi-factor authentication for all roles.</li>
        <li>Error monitoring with personal data scrubbing.</li>
        <li>Separate preview and production environments with their own keys.</li>
        <li>An external security review.</li>
      </ul>

      <h2>Reporting a problem</h2>
      <p>Please report suspected vulnerabilities to security@daktariscribe.com.</p>
    </LegalPageLayout>
  );
}
