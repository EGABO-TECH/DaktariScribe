import LegalPageLayout from "@/components/legal/LegalPageLayout";

export const metadata = {
  title: "Compliance — DaktariScribe",
  description: "DaktariScribe regulatory compliance framework under Ugandan law and international healthcare data standards.",
};

export default function CompliancePage() {
  return (
    <LegalPageLayout
      title="Compliance Framework"
      badge="Regulatory Compliance"
      badgeIcon="verified_user"
      lastUpdated="1 August 2026"
    >
      <p className="section-intro">
        DaktariScribe is built on a rigorous compliance foundation anchored in Ugandan law and aligned with international healthcare data standards. We are committed to maintaining the highest standards of data governance, clinical safety, and regulatory adherence across all operations in Uganda and beyond.
      </p>

      <h2>1. Applicable Regulatory Frameworks</h2>

      <h3>Uganda Data Protection and Privacy Act, 2019 (PDPA)</h3>
      <p>DaktariScribe complies with the <strong>Data Protection and Privacy Act 2019 (Act No. 9 of 2019)</strong> and the associated Data Protection and Privacy Regulations 2021. We are registered with the <strong>Personal Data Protection Office (PDPO)</strong>, operating under the <strong>National Information Technology Authority — Uganda (NITA-U)</strong>, as both a data controller and data processor. All rights enumerated under the PDPA — including the right to access, rectification, erasure, and objection — are upheld for all data subjects.</p>

      <h3>Uganda Computer Misuse Act, 2011</h3>
      <p>Our platform and all data handling practices are designed in full compliance with the <strong>Computer Misuse Act 2011</strong> of Uganda, which governs unauthorised access to computer systems, electronic fraud, and cyber harassment. Our security controls, access management systems, and incident response procedures are calibrated to prevent and respond to offences defined under this Act.</p>

      <h3>Electronic Transactions Act, 2011 &amp; Electronic Signatures Act, 2011</h3>
      <p>DaktariScribe&rsquo;s electronic clinical records, audit logs, and digital signatures are handled in accordance with the <strong>Electronic Transactions Act 2011</strong> and <strong>Electronic Signatures Act 2011</strong>, ensuring legal validity and evidentiary admissibility of digital clinical documentation in Uganda.</p>

      <h3>Uganda Communications Commission (UCC) Regulations</h3>
      <p>As a digital health platform transmitting data over electronic communications networks in Uganda, DaktariScribe complies with applicable directives and regulations issued by the <strong>Uganda Communications Commission (UCC)</strong>, including those concerning data localisation and network security obligations where applicable.</p>

      <h3>Ministry of Health — Uganda National Health Policy III</h3>
      <p>Our clinical AI outputs, documentation standards, and data sharing practices are aligned with the <strong>Uganda National Health Policy III</strong> and guidelines issued by the <strong>Ministry of Health, Republic of Uganda</strong>, including the National Health Records and Health Information Management Policy.</p>

      <h3>General Data Protection Regulation (GDPR)</h3>
      <p>Where DaktariScribe processes the personal data of individuals in the European Economic Area (EEA), we comply with the GDPR (EU 2016/679) as an international best-practice benchmark and legal obligation. This includes implementing Privacy by Design, maintaining records of processing activities, and appointing a Data Protection Officer (DPO).</p>

      <h3>ISO/IEC 27001 Information Security</h3>
      <p>Our information security management system is aligned with ISO/IEC 27001 standards. We undergo annual third-party audits to verify controls across access management, asset security, cryptography, physical security, and incident response.</p>

      <h2>2. Data Classification</h2>
      <p>We classify data into four tiers:</p>
      <ul>
        <li><strong>Tier 1 — Public:</strong> Marketing content, published documentation.</li>
        <li><strong>Tier 2 — Internal:</strong> Operational data accessible only to authorised staff.</li>
        <li><strong>Tier 3 — Confidential:</strong> Account credentials, audit logs, system configurations.</li>
        <li><strong>Tier 4 — Restricted (Clinical):</strong> Patient encounter data, voice recordings, generated clinical notes, and all personal health information (PHI). The highest protection controls apply, consistent with the Uganda PDPA 2019 provisions on sensitive personal data.</li>
      </ul>

      <h2>3. AI Model Governance</h2>
      <p>Our multi-model AI pipeline is subject to the following governance controls:</p>
      <ul>
        <li>Models are evaluated quarterly for bias, clinical accuracy, and hallucination rates.</li>
        <li>No Tier 4 data is used to train third-party commercial models without explicit, informed consent consistent with Uganda PDPA 2019, Section 8.</li>
        <li>Human-in-the-loop validation is mandatory for all AI-generated clinical outputs before they enter official records — in line with Ministry of Health Uganda guidelines on clinical AI.</li>
        <li>We maintain a model card for each AI component, documenting training data sources, known limitations, and intended use scope.</li>
      </ul>

      <h2>4. Breach Notification</h2>
      <p>In the event of a data breach affecting personal or clinical data, DaktariScribe will comply with the notification obligations under <strong>Uganda PDPA 2019, Section 26</strong>:</p>
      <ul>
        <li>Notify the <strong>Personal Data Protection Office (PDPO / NITA-U)</strong> within <strong>48 hours</strong> of becoming aware of the breach.</li>
        <li>Notify affected data subjects without undue delay where the breach is likely to result in high risk to their rights and freedoms.</li>
        <li>Provide a full incident report detailing the scope, categories of data involved, likely consequences, and remediation measures taken.</li>
        <li>Where applicable, simultaneously notify the GDPR supervisory authority if EEA residents are affected.</li>
      </ul>

      <h2>5. Third-Party Vendor Assessment</h2>
      <p>All vendors with access to Tier 3 or Tier 4 data undergo a formal security assessment before onboarding, including review of their audit reports, penetration test results, and data processing agreements. Vendor data processing agreements are drafted in accordance with <strong>Uganda PDPA 2019, Section 19</strong> on data processor obligations. Vendor access is reviewed annually.</p>

      <h2>6. Staff Training</h2>
      <p>All DaktariScribe employees and contractors handling clinical or personal data complete mandatory training on Uganda data protection law, information security, and ethical AI practices upon joining and annually thereafter. Training is conducted with reference to PDPO guidance materials published by NITA-U.</p>

      <h2>7. Compliance Contact</h2>
      <p>For compliance enquiries, regulatory requests, or to report a potential violation, contact our Compliance Officer at <a href="mailto:compliance@daktariscribe.com">compliance@daktariscribe.com</a>.</p>
      <p>Our designated Data Protection Officer (DPO) can be reached at <a href="mailto:dpo@daktariscribe.com">dpo@daktariscribe.com</a>.</p>
      <p>To raise a complaint with Uganda&rsquo;s data protection regulator: <strong>Personal Data Protection Office (PDPO), NITA-U, Palm Courts, Plot 7A Rotary Avenue (Lugogo Bypass), Kampala, Uganda.</strong></p>
    </LegalPageLayout>
  );
}
