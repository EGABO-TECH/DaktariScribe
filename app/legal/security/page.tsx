import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Security — DaktariScribe",
  description: "DaktariScribe security architecture, encryption standards, and access controls for clinical data.",
};

export default function SecurityPage() {
  return (
    <LegalPageLayout
      title="Security"
      badge="Platform Security"
      badgeIcon="lock"
      lastUpdated="1 August 2026"
    >
      <p className="section-intro">
        Security is foundational to DaktariScribe. Clinical data demands the highest levels of protection. This page outlines our security architecture, controls, and responsible disclosure programme — implemented in accordance with Uganda&rsquo;s <strong>Computer Misuse Act 2011</strong>, the <strong>Data Protection and Privacy Act 2019</strong>, and international ISO/IEC 27001 standards.
      </p>

      <h2>1. Encryption</h2>
      <h3>Data at Rest</h3>
      <p>All data stored on DaktariScribe infrastructure — including clinical encounter files, voice recordings, and account records — is encrypted using <strong>AES-256</strong> with keys managed through a dedicated Hardware Security Module (HSM). Database-level encryption is enforced with envelope encryption for Tier 4 (clinical) data, consistent with the sensitive personal data protection obligations of the <strong>Uganda PDPA 2019</strong>.</p>
      <h3>Data in Transit</h3>
      <p>All communications between your device and DaktariScribe servers are protected by <strong>TLS 1.3</strong>. Older protocol versions (TLS 1.0, 1.1) and weak cipher suites are explicitly disabled. HTTP Strict Transport Security (HSTS) is enforced. These controls align with directives from the <strong>Uganda Communications Commission (UCC)</strong> on electronic communications security.</p>
      <h3>Voice Audio Encryption</h3>
      <p>Audio recordings captured during encounters are encrypted client-side before transmission using a per-session ephemeral key, ensuring audio content is never transmitted in plaintext — complying with the interception protections under the <strong>Computer Misuse Act 2011, Section 12</strong>.</p>

      <h2>2. Access Control</h2>
      <ul>
        <li><strong>Role-Based Access Control (RBAC):</strong> Access to all system components is governed by least-privilege RBAC. Roles include Clinician, Supervisor, Facility Admin, and System Admin, each with strictly scoped permissions consistent with the PDPA 2019 data minimisation principle.</li>
        <li><strong>Multi-Factor Authentication (MFA):</strong> MFA via TOTP (authenticator app) is strongly recommended and mandatory for Facility Admin and System Admin roles.</li>
        <li><strong>Session Management:</strong> Sessions expire after 30 minutes of inactivity. Concurrent session limits are enforced. All active sessions are visible and revocable from the account dashboard.</li>
        <li><strong>Privileged Access Management (PAM):</strong> DaktariScribe engineers access production systems through a bastion host with just-in-time access grants, full session recording, and dual-approval for destructive operations.</li>
      </ul>

      <h2>3. Infrastructure Security</h2>
      <p>DaktariScribe infrastructure is hosted on certified cloud providers with the following controls in place:</p>
      <ul>
        <li>Network segmentation with private subnets for all data-tier services.</li>
        <li>Web Application Firewall (WAF) protecting all public endpoints.</li>
        <li>DDoS mitigation through multi-layer rate limiting and upstream scrubbing services.</li>
        <li>Immutable audit logs shipped to a tamper-evident, write-once storage system — supporting the audit trail requirements of the <strong>Electronic Transactions Act 2011</strong>.</li>
        <li>Automated vulnerability scanning on every code deployment via CI/CD pipeline.</li>
        <li>Container image signing and integrity verification before deployment.</li>
      </ul>

      <h2>4. Penetration Testing &amp; Audits</h2>
      <p>DaktariScribe engages independent, accredited security firms to conduct:</p>
      <ul>
        <li><strong>Annual full-scope penetration tests</strong> covering web application, API, network, and mobile attack surfaces.</li>
        <li><strong>Quarterly automated scans</strong> for known CVEs across all dependencies.</li>
        <li><strong>ISO/IEC 27001 aligned security audits</strong> covering the Security, Availability, and Confidentiality trust service criteria.</li>
      </ul>
      <p>Audit summary reports are available to enterprise and institutional customers upon request under NDA.</p>

      <h2>5. Secure Development Lifecycle (SDL)</h2>
      <ul>
        <li>All code undergoes mandatory peer review before merging.</li>
        <li>Static Application Security Testing (SAST) and Dynamic Application Security Testing (DAST) are integrated into our CI/CD pipeline.</li>
        <li>Dependency updates are monitored continuously; critical CVEs are patched within 48 hours.</li>
        <li>Secrets and API keys are managed through a centralised vault and are never committed to source code.</li>
      </ul>

      <h2>6. Offline &amp; Field Security</h2>
      <p>DaktariScribe supports offline-resilient operation for frontline field workers across Uganda. Offline data is stored in an encrypted local datastore (AES-256) on the device. Sync occurs exclusively over authenticated, encrypted channels. Devices can be remotely wiped via the admin dashboard in the event of loss or theft — a critical safeguard for rural and outreach deployments.</p>

      <h2>7. Incident Response</h2>
      <p>DaktariScribe maintains a documented Incident Response Plan (IRP) aligned with obligations under the <strong>Uganda PDPA 2019, Section 26</strong> (breach notification) and the <strong>Computer Misuse Act 2011</strong>. The IRP includes defined roles, escalation paths, and communication templates. All security incidents are logged, triaged within 2 hours, and subject to a post-incident review. The <strong>PDPO / NITA-U</strong> is notified within 48 hours of a confirmed breach, and affected users are notified without undue delay.</p>

      <h2>8. Responsible Disclosure</h2>
      <p>We operate a responsible disclosure programme. If you discover a security vulnerability in our platform, please report it to <a href="mailto:security@daktariscribe.com">security@daktariscribe.com</a>. We commit to:</p>
      <ul>
        <li>Acknowledging your report within 48 hours.</li>
        <li>Providing a remediation timeline within 10 business days.</li>
        <li>Recognising your contribution (with your permission) in our Security Hall of Fame.</li>
        <li>Not pursuing legal action against good-faith researchers acting within this policy, consistent with the intent of the <strong>Uganda Computer Misuse Act 2011</strong>.</li>
      </ul>

      <h2>9. Security Contact</h2>
      <p>For security-related concerns, contact our Security Operations Centre at <a href="mailto:security@daktariscribe.com">security@daktariscribe.com</a>. <strong>DaktariScribe Ltd, Kampala, Uganda.</strong> For PGP-encrypted communications, our public key is available upon request.</p>
    </LegalPageLayout>
  );
}
