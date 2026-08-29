import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Terms of Service — DaktariScribe",
  description: "DaktariScribe Terms of Service governing your use of the clinical scribe platform.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      badge="User Agreement"
      badgeIcon="gavel"
      lastUpdated="1 August 2026"
    >
      <p className="section-intro">
        By creating an account or accessing any part of the DaktariScribe System Portal, you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). Please read them carefully. If you do not agree, do not register or use the platform.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>These Terms constitute a legally binding agreement between you (&ldquo;User&rdquo;) and DaktariScribe Ltd (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;). Use of the platform signifies full, unconditional acceptance of these Terms and our Privacy Policy. DaktariScribe operates in compliance with the laws of the Republic of Uganda.</p>

      <h2>2. Eligibility</h2>
      <p>You must be at least 18 years of age and a licensed or authorised healthcare professional, medical student under supervision, or administrative staff member of a registered health facility to use DaktariScribe. Registering on behalf of an organisation constitutes a warranty that you have authority to bind that organisation to these Terms. Healthcare workers must hold valid registration with the appropriate Ugandan regulatory body (e.g., Uganda Medical and Dental Practitioners Council, Uganda Nurses and Midwives Council, Uganda Pharmacy Council).</p>

      <h2>3. Account Registration</h2>
      <ul>
        <li>You must provide accurate, current, and complete information during registration.</li>
        <li>You are solely responsible for maintaining the confidentiality of your credentials.</li>
        <li>You must notify us immediately at <a href="mailto:support@daktariscribe.com">support@daktariscribe.com</a> if you suspect unauthorised access to your account.</li>
        <li>You may not share account credentials or allow third-party access to your account.</li>
      </ul>

      <h2>4. Permitted Use</h2>
      <p>DaktariScribe grants you a limited, non-exclusive, non-transferable, revocable licence to use the platform for lawful clinical documentation purposes. You agree not to:</p>
      <ul>
        <li>Use the platform for any unlawful purpose or in violation of Ugandan law, including the <strong>Computer Misuse Act 2011</strong> and the <strong>Electronic Transactions Act 2011</strong>.</li>
        <li>Attempt to reverse-engineer, decompile, or extract source code from the platform.</li>
        <li>Transmit malware, spam, or any code designed to damage or intercept data.</li>
        <li>Scrape, harvest, or systematically extract data from the platform without express written permission.</li>
        <li>Misrepresent your professional credentials or identity when registering encounters.</li>
        <li>Use AI-generated outputs as a substitute for professional clinical judgement.</li>
      </ul>

      <h2>5. Clinical Responsibility Disclaimer</h2>
      <p>DaktariScribe provides an AI-assisted documentation tool. <strong>All clinical decisions remain the sole responsibility of the licensed healthcare professional.</strong> The platform does not constitute medical advice, diagnosis, or treatment. AI-generated notes must be reviewed, validated, and countersigned by a qualified clinician before inclusion in official patient records. DaktariScribe complies with the <strong>Uganda National Health Policy III</strong> and guidelines issued by the <strong>Ministry of Health, Uganda</strong>.</p>

      <h2>6. Intellectual Property</h2>
      <p>All platform software, algorithms, branding, and content are the exclusive property of DaktariScribe Ltd and protected by applicable intellectual property laws, including the <strong>Uganda Registration Services Bureau (URSB)</strong> registered rights and the <strong>Copyright and Neighbouring Rights Act, Cap 215</strong> of Uganda. You retain ownership of clinical data you input but grant DaktariScribe a limited licence to process that data to deliver the service.</p>

      <h2>7. Subscription &amp; Payment</h2>
      <p>Access to premium features requires a valid subscription. Fees are billed in advance on a monthly or annual basis in Uganda Shillings (UGX) or agreed foreign currency. All payments are non-refundable except where required by Ugandan consumer protection law. We reserve the right to modify pricing with 30 days&rsquo; written notice.</p>

      <h2>8. Suspension &amp; Termination</h2>
      <p>We may suspend or terminate your account immediately and without notice if you breach these Terms, engage in fraudulent activity, or if required by a Ugandan regulatory authority or court. Upon termination, your right to access the platform ceases immediately, though we will retain your clinical data in accordance with our Privacy Policy and applicable Ugandan data retention regulations.</p>

      <h2>9. Limitation of Liability</h2>
      <p>To the maximum extent permitted by Ugandan law, DaktariScribe shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the platform. Our aggregate liability shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

      <h2>10. Governing Law &amp; Dispute Resolution</h2>
      <p>These Terms are governed exclusively by the <strong>laws of the Republic of Uganda</strong>. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the <strong>courts of Kampala, Uganda</strong>. The parties agree to attempt good-faith mediation through the <strong>Uganda Arbitration Centre</strong> before commencing formal legal proceedings.</p>

      <h2>11. Regulatory Compliance</h2>
      <p>DaktariScribe operates in compliance with all applicable Ugandan regulations, including the <strong>Data Protection and Privacy Act 2019</strong>, the <strong>Computer Misuse Act 2011</strong>, the <strong>Electronic Transactions Act 2011</strong>, the <strong>Electronic Signatures Act 2011</strong>, and all directions issued by <strong>NITA-U</strong> and the <strong>Uganda Communications Commission (UCC)</strong>.</p>

      <h2>12. Amendments</h2>
      <p>We reserve the right to modify these Terms at any time. Significant changes will be communicated via email or in-app notification at least 14 days in advance. Your continued use of the platform after the effective date constitutes acceptance.</p>

      <h2>13. Contact</h2>
      <p>For questions regarding these Terms, contact us at <a href="mailto:legal@daktariscribe.com">legal@daktariscribe.com</a> or write to <strong>DaktariScribe Ltd, Kampala, Uganda.</strong></p>
    </LegalPageLayout>
  );
}
