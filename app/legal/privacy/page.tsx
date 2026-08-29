import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Privacy Policy — DaktariScribe",
  description: "DaktariScribe Privacy Policy: how we collect, use, and protect your health data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      badge="Data & Privacy"
      badgeIcon="shield_person"
      lastUpdated="1 August 2026"
    >
      <p className="section-intro">
        DaktariScribe Pharma Network (&ldquo;DaktariScribe,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting the privacy and security of personal and clinical information. This Privacy Policy explains how we collect, process, store, and safeguard your data when you access or use the DaktariScribe System Portal.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>1.1 Account Information</h3>
      <p>When you register for a DaktariScribe account, we collect your full name, professional email address, and a hashed password. We do not store plaintext passwords under any circumstances.</p>
      <h3>1.2 Clinical Data</h3>
      <p>When you use the scribe and dictation features, we process voice audio, transcribed text, medication findings, encounter notes, and generated PDF reports. This data is associated with your account and the encounter session you create.</p>
      <h3>1.3 Device &amp; Usage Data</h3>
      <p>We automatically collect device type, operating system, browser version, IP address (anonymised after 90 days), session timestamps, and feature interaction events for the purpose of service reliability and improvement.</p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To authenticate your identity and maintain secure access to the system portal.</li>
        <li>To process voice recordings and text input into structured clinical notes.</li>
        <li>To generate and deliver PDF clinical summaries to authorised practitioners.</li>
        <li>To comply with Uganda&rsquo;s <strong>Data Protection and Privacy Act, 2019 (PDPA)</strong>, the GDPR where applicable, and the HIPAA standards framework.</li>
        <li>To detect, investigate, and prevent security incidents and fraudulent activity.</li>
        <li>To improve model accuracy through aggregated, de-identified analytics (with explicit opt-in consent).</li>
      </ul>

      <h2>3. Legal Basis for Processing</h2>
      <p>We process your personal data on the following legal bases under the Uganda PDPA 2019: <strong>contractual necessity</strong> (to provide the service you registered for), <strong>legitimate interests</strong> (system security, fraud prevention), <strong>legal obligation</strong> (compliance with health data regulations), and <strong>consent</strong> (for optional analytics and research participation). Consent may be withdrawn at any time without prejudice to processing already carried out.</p>

      <h2>4. Data Sharing &amp; Disclosure</h2>
      <p>We do not sell, rent, or trade your personal or clinical data to third parties. We may share data with:</p>
      <ul>
        <li><strong>Cloud infrastructure providers</strong> under binding data processing agreements, solely to host and operate the platform.</li>
        <li><strong>AI model providers</strong> under strict agreements that prohibit training on your identifiable data without consent.</li>
        <li><strong>Regulatory or law enforcement authorities</strong> when required by Ugandan law or a lawful court order.</li>
        <li><strong>Successor entities</strong> in the event of a merger or acquisition, subject to equivalent privacy protections.</li>
      </ul>

      <h2>5. Data Retention</h2>
      <p>Account data is retained for the duration of your active subscription plus 24 months, unless a longer retention period is required by Ugandan law. Clinical encounter data is retained for a minimum of 7 years in accordance with the Uganda Medical and Dental Practitioners Act and the National Health Records and Health Information policy. You may request earlier deletion subject to legal constraints by contacting <a href="mailto:privacy@daktariscribe.com">privacy@daktariscribe.com</a>.</p>

      <h2>6. Your Rights Under the Uganda PDPA 2019</h2>
      <p>Under the Uganda Data Protection and Privacy Act 2019, you have the right to:</p>
      <ul>
        <li>Be informed about the collection and use of your personal data.</li>
        <li>Access a copy of the personal data we hold about you.</li>
        <li>Correct inaccurate or incomplete information.</li>
        <li>Object to processing of your personal data in certain circumstances.</li>
        <li>Request erasure of your data where it is no longer necessary and no legal obligation requires retention.</li>
        <li>Withdraw consent at any time without affecting the lawfulness of prior processing.</li>
        <li>Lodge a complaint with the <strong>Personal Data Protection Office (PDPO)</strong> of Uganda under NITA-U.</li>
      </ul>
      <p>To exercise any of these rights, submit a written request to <a href="mailto:privacy@daktariscribe.com">privacy@daktariscribe.com</a>. We will respond within 21 days as required by the PDPA.</p>

      <h2>7. Security Measures</h2>
      <p>We implement AES-256 encryption at rest, TLS 1.3 in transit, role-based access controls, multi-factor authentication, regular penetration testing, and externally audited infrastructure. Despite these measures, no system is 100% secure; we encourage users to use strong, unique passwords and enable MFA.</p>

      <h2>8. Cookies &amp; Tracking</h2>
      <p>We use strictly necessary session cookies for authentication and optionally use analytics cookies (with your consent). You can manage cookie preferences through your browser settings or our in-app cookie consent manager.</p>

      <h2>9. International Transfers</h2>
      <p>Your data may be processed in jurisdictions outside Uganda. In such cases, we ensure adequate safeguards are in place consistent with Section 19 of the Uganda PDPA 2019, including contractual protections and adequacy determinations by the PDPO.</p>

      <h2>10. Changes to This Policy</h2>
      <p>We may update this Privacy Policy periodically. Material changes will be communicated via email or an in-app notice at least 14 days before they take effect. Continued use of the platform after that date constitutes acceptance of the updated policy.</p>

      <h2>11. Contact &amp; Supervisory Authority</h2>
      <p>For privacy-related enquiries, contact our Data Protection Officer at <a href="mailto:dpo@daktariscribe.com">dpo@daktariscribe.com</a> or write to: <strong>DaktariScribe Ltd, Kampala, Uganda.</strong></p>
      <p>You may also raise a complaint directly with Uganda&rsquo;s data protection regulator: <strong>Personal Data Protection Office (PDPO), National Information Technology Authority — Uganda (NITA-U), Palm Courts, Plot 7A Rotary Avenue (Lugogo Bypass), Kampala.</strong></p>
    </LegalPageLayout>
  );
}
