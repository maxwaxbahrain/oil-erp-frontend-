import LegalDocumentLayout, {
  LegalBulletList,
  LegalSection,
  LegalSubsection,
} from './legal/LegalDocumentLayout';

export default function PrivacyPolicy() {
  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      intro={
        <>
          This Privacy Policy explains how Soltol LLC (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), operator of the
          SOLTOL ONE platform (&quot;SOLTOL,&quot; the &quot;Service&quot;), collects, uses, stores, and protects information when
          you use the Service. By creating an account or using SOLTOL, you agree to the practices described here.
          <br />
          <br />
          SOLTOL is a business-to-business software platform. Our customers are businesses (&quot;Tenants&quot;) that use SOLTOL
          to manage their distribution operations. This policy covers both the personal information of the individuals who
          administer or use a Tenant account, and, at a high level, how we handle the business data our Tenants store in the
          Service.
        </>
      }
    >
      <LegalSection title="1. Who we are">
        <p style={{ margin: 0 }}>
          The Service is provided by Soltol LLC. For any privacy-related question or request, contact us at
          info@soltol.com.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <LegalSubsection title="2.1 Information you provide directly">
          <LegalBulletList
            items={[
              <>
                <strong style={{ color: '#ffffff' }}>Account information:</strong> name, username, email address, and
                password (stored only in hashed form) when you register or are added to a Tenant account.
              </>,
              <>
                <strong style={{ color: '#ffffff' }}>Company profile:</strong> business name, address, phone number, email,
                tax identifiers, and logo that a Tenant enters to configure its account.
              </>,
              <>
                <strong style={{ color: '#ffffff' }}>Support communications:</strong> information you send us when you
                contact us for help.
              </>,
            ]}
          />
        </LegalSubsection>

        <LegalSubsection title="2.2 Tenant business data">
          <p style={{ margin: '0 0 12px' }}>
            When you use SOLTOL, you store business records in the Service — for example customers, suppliers, invoices,
            payments, products, inventory, accounting entries, delivery records, and related documents. This &quot;Tenant
            Data&quot; is owned and controlled by the Tenant. We process it on the Tenant&apos;s behalf to provide the Service.
            We do not use Tenant Data for our own purposes except as needed to operate, secure, and improve the Service, or
            as required by law.
          </p>
          <p style={{ margin: 0 }}>
            Tenant Data may include personal information about the Tenant&apos;s own customers or employees (for example
            names, addresses, phone numbers, and cheque or payment details). The Tenant is responsible for having a lawful
            basis to collect and store that information and for its own privacy obligations toward those individuals.
          </p>
        </LegalSubsection>

        <LegalSubsection title="2.3 Information collected automatically">
          <LegalBulletList
            items={[
              <>
                <strong style={{ color: '#ffffff' }}>Usage and log data:</strong> actions taken in the Service, timestamps,
                and IP address, used for security, troubleshooting, and improving reliability.
              </>,
              <>
                <strong style={{ color: '#ffffff' }}>Login history:</strong> records of sign-in activity to help detect
                unauthorized access.
              </>,
              <>
                <strong style={{ color: '#ffffff' }}>AI usage metering:</strong> counts of AI-assisted actions and
                associated token usage, used for quota enforcement and billing.
              </>,
            ]}
          />
        </LegalSubsection>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <p style={{ margin: '0 0 12px' }}>We use the information we collect to:</p>
        <LegalBulletList
          items={[
            'Provide, operate, and maintain the Service.',
            'Authenticate users and secure accounts.',
            'Process billing and enforce plan limits.',
            'Respond to support requests.',
            'Monitor, troubleshoot, and improve reliability, security, and performance.',
            'Detect, prevent, and address fraud, abuse, or security incidents.',
            'Comply with legal obligations.',
          ]}
        />
        <p style={{ margin: '12px 0 0' }}>
          We do not sell personal information, and we do not display third-party advertising in the Service.
        </p>
      </LegalSection>

      <LegalSection title="4. AI features and sub-processors">
        <p style={{ margin: '0 0 12px' }}>
          SOLTOL includes AI-assisted features (for example a business advisor, voice command handling, and document
          assistance). To provide these, relevant portions of your input may be sent to third-party AI service providers
          (&quot;AI Sub-processors&quot;) solely to generate a response back to you. Our current AI and infrastructure
          sub-processors include:
        </p>
        <LegalBulletList
          items={[
            'Anthropic — large language model processing for AI assistant and document features.',
            'Deepgram — speech-to-text transcription for voice command features.',
            'Neon — managed PostgreSQL database hosting.',
            'Render — application hosting.',
            'Cloudflare — object storage (R2) for uploaded files and backups.',
          ]}
        />
        <p style={{ margin: '12px 0 0' }}>
          We share only the data necessary for each provider to perform its function, and we require sub-processors to protect
          the information they process. We may update this list as our providers change; the current list will always be
          available here or on request at info@soltol.com.
        </p>
      </LegalSection>

      <LegalSection title="5. How we store and protect information">
        <LegalBulletList
          items={[
            'Data is stored in managed cloud infrastructure (currently PostgreSQL databases and object storage as described above).',
            'Passwords are stored only as cryptographic hashes, never in plain text.',
            'Access to Tenant Data is scoped per Tenant, so one Tenant cannot access another Tenant\'s data through the Service.',
            'We take reasonable technical and organizational measures to protect information against unauthorized access, loss, or misuse.',
          ]}
        />
        <p style={{ margin: '12px 0 0' }}>
          No method of transmission or storage is completely secure, and we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="6. Data retention">
        <p style={{ margin: 0 }}>
          We retain account and Tenant Data for as long as the Tenant maintains an active account, and for a reasonable
          period afterward as needed to comply with legal, tax, and accounting obligations, resolve disputes, and enforce
          our agreements. A Tenant may request deletion of its data as described in Section 7.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights and choices">
        <p style={{ margin: '0 0 12px' }}>
          Depending on your location, you may have rights to access, correct, export, or delete personal information we
          hold about you. Because much of the personal information in the Service is Tenant Data controlled by a Tenant,
          requests about that data should generally be directed to the relevant Tenant, and we will assist the Tenant in
          responding.
        </p>
        <p style={{ margin: 0 }}>
          To make a request relating to information we control, or to ask a question about this policy, contact
          info@soltol.com. We will respond within the time required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="8. International users">
        <p style={{ margin: 0 }}>
          The Service may be operated from, and information may be processed in, jurisdictions other than the one in which you
          reside. By using the Service, you understand that your information may be transferred to and processed in those
          jurisdictions.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p style={{ margin: 0 }}>
          The Service is intended for use by businesses and is not directed to individuals under 18. We do not knowingly
          collect personal information from children.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to this policy">
        <p style={{ margin: 0 }}>
          We may update this Privacy Policy from time to time. When we make material changes, we will update the &quot;Last
          updated&quot; date above and, where appropriate, notify Tenants through the Service. Your continued use of the
          Service after changes take effect constitutes acceptance of the updated policy.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p style={{ margin: '0 0 12px' }}>Questions or requests regarding this Privacy Policy can be sent to:</p>
        <p style={{ margin: 0 }}>
          Soltol LLC
          <br />
          Email: info@soltol.com
        </p>
        <p style={{ margin: '16px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          This document is a general first draft provided for launch readiness and does not constitute legal advice. Have it
          reviewed by qualified legal counsel in the State of New York, United States before relying on it.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
