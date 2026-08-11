import LegalDocumentLayout, { LegalBulletList, LegalSection } from './legal/LegalDocumentLayout';

const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14, marginTop: 12 };
const thStyle = {
  border: '1px solid rgba(79,107,244,0.2)',
  padding: '10px 12px',
  textAlign: 'left' as const,
  color: '#ffffff',
  fontWeight: 600,
  verticalAlign: 'top' as const,
};
const tdStyle = {
  border: '1px solid rgba(79,107,244,0.15)',
  padding: '10px 12px',
  verticalAlign: 'top' as const,
};

export default function SubProcessors() {
  return (
    <LegalDocumentLayout
      title="Sub-processors"
      intro={
        <>
          Soltol LLC uses the third-party service providers listed below (&quot;sub-processors&quot;) to operate the SOLTOL
          ONE platform. Each processes data only as needed to perform its function, and each is bound by its own data
          protection commitments.
          <br />
          <br />
          We may update this list as our infrastructure changes. Material additions will be reflected here, and Tenants
          may request notification of changes by contacting info@soltol.com.
        </>
      }
    >
      <LegalSection title="Infrastructure">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Sub-processor</th>
              <th style={thStyle}>Purpose</th>
              <th style={thStyle}>Data processed</th>
              <th style={thStyle}>Primary location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Neon</td>
              <td style={tdStyle}>Managed PostgreSQL database — primary application data store</td>
              <td style={tdStyle}>
                All Tenant business data: customers, suppliers, invoices, payments, products, inventory, accounting
                entries, delivery records, user accounts
              </td>
              <td style={tdStyle}>United States (US East)</td>
            </tr>
            <tr>
              <td style={tdStyle}>Render</td>
              <td style={tdStyle}>Application hosting — runs the SOLTOL ONE web application and API</td>
              <td style={tdStyle}>
                All data in transit through the application; server logs including IP addresses
              </td>
              <td style={tdStyle}>United States</td>
            </tr>
            <tr>
              <td style={tdStyle}>Cloudflare</td>
              <td style={tdStyle}>Object storage (R2) — uploaded files and database backups</td>
              <td style={tdStyle}>
                Uploaded documents, delivery photos, signatures, logos, and encrypted database backups
              </td>
              <td style={tdStyle}>Distributed; primary region United States</td>
            </tr>
          </tbody>
        </table>
      </LegalSection>

      <LegalSection title="AI and voice features">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Sub-processor</th>
              <th style={thStyle}>Purpose</th>
              <th style={thStyle}>Data processed</th>
              <th style={thStyle}>Primary location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Anthropic</td>
              <td style={tdStyle}>
                Large language model processing for the AI business advisor, document assistance, and migration mapping
              </td>
              <td style={tdStyle}>
                Only the specific text or document content submitted to an AI feature, plus the context needed to generate
                a response
              </td>
              <td style={tdStyle}>United States</td>
            </tr>
            <tr>
              <td style={tdStyle}>Deepgram</td>
              <td style={tdStyle}>Speech-to-text transcription for voice command features</td>
              <td style={tdStyle}>Audio submitted through voice features and the resulting transcript</td>
              <td style={tdStyle}>United States</td>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: '12px 0 0' }}>
          AI features are optional. If a Tenant does not use them, no data is sent to these sub-processors.
        </p>
      </LegalSection>

      <LegalSection title="Commercial and communications">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Sub-processor</th>
              <th style={thStyle}>Purpose</th>
              <th style={thStyle}>Data processed</th>
              <th style={thStyle}>Primary location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Stripe</td>
              <td style={tdStyle}>Payment processing for subscriptions</td>
              <td style={tdStyle}>
                Billing contact details and payment metadata. Card details are collected and stored by Stripe directly;
                Soltol LLC does not receive or store full card numbers
              </td>
              <td style={tdStyle}>United States</td>
            </tr>
            <tr>
              <td style={tdStyle}>Resend</td>
              <td style={tdStyle}>Transactional email delivery (password resets, account notifications)</td>
              <td style={tdStyle}>Recipient email address and message content</td>
              <td style={tdStyle}>United States</td>
            </tr>
          </tbody>
        </table>
      </LegalSection>

      <LegalSection title="What we collect directly">
        <p style={{ margin: 0 }}>
          In addition to the sub-processors above, Soltol LLC records certain data directly, including the IP address and
          timestamp captured when a Tenant accepts these Terms at signup, retained as proof of agreement.
        </p>
      </LegalSection>

      <LegalSection title="What we do not do">
        <LegalBulletList
          items={[
            'We do not sell Tenant Data to any party.',
            'We do not use Tenant Data to train AI models.',
            'We do not display third-party advertising in the Service.',
            'We do not share Tenant Data with sub-processors beyond what each requires to perform its stated function.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Questions">
        <p style={{ margin: '0 0 12px' }}>Requests for further detail can be sent to info@soltol.com.</p>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          This document is provided for transparency and does not itself constitute a data processing agreement. Soltol
          LLC can provide a DPA on request. This document has not yet been reviewed by legal counsel.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
