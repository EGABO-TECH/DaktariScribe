import LegalPageLayout from "@/components/legal/LegalPageLayout";
import LegalReviewNotice from "@/components/legal/LegalReviewNotice";

export const metadata = {
  title: "Privacy Policy — DaktariScribe",
  description: "How DaktariScribe collects, processes, stores and protects personal and health information.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" badge="Data & Privacy" badgeIcon="shield_person" lastUpdated="5 November 2026">
      <LegalReviewNotice />
      <p>
        DaktariScribe (&ldquo;we&rdquo;) provides software that health workers use to record clinical encounters and prepare reports. This policy explains what information
        the software handles and how it is protected. It is written to align with Uganda&rsquo;s Data Protection and Privacy Act, 2019.
      </p>

      <h2>1. Information we handle</h2>
      <h3>1.1 Your account</h3>
      <p>Your name, email address and sign-in details are managed by our authentication provider, Clerk. We do not store your password.</p>
      <h3>1.2 Encounter records</h3>
      <ul>
        <li>What you capture: typed notes, voice recordings, and files you upload (photos of notes, PDF, Word, Excel or CSV).</li>
        <li>Encounter details: template, site, date, an optional respondent reference (we ask for a local ID, not a name), interview language and whether consent was obtained.</li>
        <li>The organised record, your edits (each saved as a new version), your sign-off and any translations.</li>
      </ul>
      <h3>1.3 Payments</h3>
      <p>For prepaid passes we store the product, amount, status and a masked phone number. Your full mobile number is stored encrypted. Card details are entered on our payment provider&rsquo;s page and never reach our servers.</p>
      <h3>1.4 Usage</h3>
      <p>We record counts (reports processed, audio seconds, characters translated, exports) and an audit log of actions such as viewing, editing, signing off and exporting. These records contain identifiers, never note content.</p>

      <h2>2. Consent</h2>
      <p>A record cannot be saved unless the health worker confirms that consent was obtained from the respondent for that encounter.</p>

      <h2>3. Automated processing</h2>
      <p>
        To save time, recordings and notes are processed by automated services. The health worker reviews everything and signs it off; nothing becomes final without that
        sign-off. The automated steps are:
      </p>
      <ul>
        <li><strong>Automated transcription</strong> of English recordings by AssemblyAI, and of recordings in Ugandan and other African languages by Sunbird AI.</li>
        <li><strong>Automated text processing</strong> by Anthropic (paid API, which does not use customer data to train its models): organising notes into the chosen template, reading photos and scans of notes, and translating reports into some languages.</li>
        <li><strong>Automated translation</strong> into African languages by Sunbird AI.</li>
      </ul>
      <p>
        Before any text is sent to these services we replace names, phone numbers, national ID numbers, email addresses and the respondent reference with placeholders, and put
        them back afterwards. Audio cannot be altered this way, so recordings are sent as captured; we only use providers whose terms do not allow training on customer data.
        Code checks every organised record against the original and flags any number, medicine or statement that is not in the original notes.
      </p>

      <h2>4. Storage and security</h2>
      <ul>
        <li>Originals (typed notes, recordings, files) are kept unchanged. Organised versions, edits and translations are stored separately.</li>
        <li>Note text, record content, respondent references and stored files are encrypted with AES-256-GCM before they are written to our database or file storage.</li>
        <li>On your device, drafts, recordings and files are encrypted with a key derived from your PIN, lock after 10 minutes without use, and are deleted when you sign out.</li>
        <li>Access is limited to your organisation; health workers see only their own records and supervisors see their organisation&rsquo;s records.</li>
        <li>We do not write note content to our logs.</li>
      </ul>

      <h2>5. Sub-processors</h2>
      <ul>
        <li>Clerk: sign-in and account management.</li>
        <li>Neon: database hosting.</li>
        <li>Cloudflare R2: encrypted file storage (when enabled).</li>
        <li>Vercel: application hosting.</li>
        <li>Inngest: background job scheduling (job payloads contain identifiers only).</li>
        <li>AssemblyAI and Sunbird AI: automated transcription; Sunbird AI also for translation.</li>
        <li>Anthropic: automated text processing, reading scans and translation.</li>
        <li>Nylon Pay: payments.</li>
      </ul>

      <h2>6. Sharing</h2>
      <p>We never sell or share patient data, and we do not use it for advertising. Data is shared only with the sub-processors above, to provide the service.</p>

      <h2>7. Your rights</h2>
      <p>You may ask to access, correct or delete personal information, subject to your organisation&rsquo;s record-keeping duties. Contact us at the address below.</p>

      <h2>8. Contact</h2>
      <p>DaktariScribe · privacy@daktariscribe.com</p>
    </LegalPageLayout>
  );
}
