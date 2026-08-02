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

export default function SecurityIncident() {
  return (
    <LegalDocumentLayout
      title="Security Incident and Breach Notification"
      intro={
        <>
          This document sets out what Soltol LLC will do if a security incident affects Tenant Data in SOLTOL ONE. It is a
          statement of commitment, not a guarantee that incidents cannot occur.
        </>
      }
    >
      <LegalSection title="What counts as a breach">
        <p style={{ margin: '0 0 12px' }}>
          A personal data breach is a security incident leading to accidental or unlawful destruction, loss, alteration,
          unauthorised disclosure of, or access to Tenant Data.
        </p>
        <p style={{ margin: '0 0 12px' }}>
          This includes unauthorised access to our database or object storage, loss of data without a recoverable backup,
          and accidental disclosure of one Tenant&apos;s data to another.
        </p>
        <p style={{ margin: 0 }}>
          It does not include a Tenant&apos;s own users misusing their legitimate access, or a Tenant&apos;s credentials being
          compromised on their side — though we will assist in either case.
        </p>
      </LegalSection>

      <LegalSection title="What we will do">
        <p style={{ margin: '0 0 12px' }}>On becoming aware of an incident:</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Stage</th>
              <th style={thStyle}>Commitment</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Contain</td>
              <td style={tdStyle}>Immediately — stop the incident spreading and preserve evidence</td>
            </tr>
            <tr>
              <td style={tdStyle}>Assess</td>
              <td style={tdStyle}>
                Within 24 hours — determine what data was affected, which Tenants are involved, and whether data was
                accessed or only exposed
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>Notify affected Tenants</td>
              <td style={tdStyle}>
                Within 72 hours of becoming aware, where the incident is likely to affect the rights or data of a Tenant
                or their customers
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>Notify authorities</td>
              <td style={tdStyle}>
                Within the period required by applicable law, where the incident meets the threshold for regulatory
                notification
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>Report</td>
              <td style={tdStyle}>
                Within 30 days — a written account of what happened, what was affected, what we did, and what changes
                prevent recurrence
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: '12px 0 0' }}>
          We will notify even where we are not legally required to, if the incident materially affects your data.
        </p>
      </LegalSection>

      <LegalSection title="How we will notify you">
        <p style={{ margin: 0 }}>
          By email, to the registered email address on your tenant account. Keep that address current — it is how we reach
          you. For incidents affecting multiple Tenants, we will also post a notice within the Service.
        </p>
      </LegalSection>

      <LegalSection title="What a notification will contain">
        <LegalBulletList
          items={[
            'What happened, in plain language',
            'When it happened and when we became aware',
            'What categories of data were affected, and roughly how many records',
            'Whether the data was accessed, exfiltrated, altered, or only exposed',
            'What we have done to contain it',
            'What you should do, if anything',
            'A named contact for follow-up questions',
          ]}
        />
        <p style={{ margin: '12px 0 0' }}>We will not delay notification because an investigation is incomplete.</p>
      </LegalSection>

      <LegalSection title="Your obligations">
        <p style={{ margin: 0 }}>
          If you become aware of a security issue affecting SOLTOL ONE — a vulnerability, suspicious activity, or a
          compromised account — report it to info@soltol.com promptly. If the incident affects your own customers, you may
          have your own notification obligations to them; those are yours to meet, and we will provide whatever information
          you need.
        </p>
      </LegalSection>

      <LegalSection title="Reporting a vulnerability">
        <p style={{ margin: 0 }}>
          If you have found a security vulnerability in SOLTOL ONE, email info@soltol.com with the details. We will
          acknowledge within 2 business days. We ask that you give us reasonable time to fix an issue before disclosing it
          publicly, and we will not pursue action against anyone who reports in good faith and does not access or alter
          data beyond what is needed to demonstrate the problem.
        </p>
      </LegalSection>

      <LegalSection title="Current limitations">
        <p style={{ margin: '0 0 12px' }}>
          Soltol LLC is an early-stage company. We do not currently hold SOC 2, ISO 27001, or equivalent certification. We
          do not currently offer a contractual uptime SLA.
        </p>
        <p style={{ margin: '0 0 12px' }}>
          What we do have: per-tenant data isolation enforced at the database layer and covered by automated tests, encrypted
          connections, passwords stored only as cryptographic hashes, and routine off-platform database backups.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          This document has not yet been reviewed by legal counsel. It reflects Soltol LLC&apos;s operational commitments and
          does not limit any obligation arising under applicable law in the State of New York, United States.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
