import LegalDocumentLayout, { LegalSection } from './legal/LegalDocumentLayout';

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

export default function DataDeletion() {
  return (
    <LegalDocumentLayout
      title="Data Deletion and Retention"
      intro={
        <>
          This document explains what happens to your data when you close your SOLTOL ONE account or request deletion. It
          applies to Soltol LLC&apos;s handling of Tenant Data.
        </>
      }
    >
      <LegalSection title="Your data is yours">
        <p style={{ margin: 0 }}>
          As stated in our Terms of Service, the Tenant owns all data entered into or generated through SOLTOL ONE. We
          process it on your behalf. You can export it at any time while your account is active, and you retain the right
          to request its deletion.
        </p>
      </LegalSection>

      <LegalSection title="Exporting before you leave">
        <p style={{ margin: '0 0 12px' }}>
          Before requesting deletion, export your data. SOLTOL ONE provides a full-tenant export covering your customers,
          suppliers, invoices, payments, products, inventory, and accounting records.
        </p>
        <p style={{ margin: '0 0 12px' }}>
          We strongly recommend exporting before closure. Your own tax and accounting obligations may require you to retain
          business records for several years after you stop using the Service — those obligations are yours, not ours, and
          we cannot satisfy them for you once your data is deleted.
        </p>
        <p style={{ margin: 0 }}>
          If you need help producing an export, contact info@soltol.com before requesting deletion.
        </p>
      </LegalSection>

      <LegalSection title="Deletion timeline">
        <p style={{ margin: '0 0 12px' }}>When you request account closure or deletion:</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Stage</th>
              <th style={thStyle}>Timeframe</th>
              <th style={thStyle}>What happens</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Request received</td>
              <td style={tdStyle}>Within 2 business days</td>
              <td style={tdStyle}>
                We acknowledge your request by email and confirm the account to be closed
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>Grace period</td>
              <td style={tdStyle}>30 days from request</td>
              <td style={tdStyle}>
                Account is deactivated — no one can log in — but data is preserved. You may still request an export, or
                cancel the deletion request
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>Active deletion</td>
              <td style={tdStyle}>Within 60 days of request</td>
              <td style={tdStyle}>Tenant Data is deleted from our production database and object storage</td>
            </tr>
            <tr>
              <td style={tdStyle}>Backup expiry</td>
              <td style={tdStyle}>As backups age out of our retention cycle</td>
              <td style={tdStyle}>Data is purged from routine backups</td>
            </tr>
            <tr>
              <td style={tdStyle}>Confirmation</td>
              <td style={tdStyle}>On completion</td>
              <td style={tdStyle}>
                We email written confirmation that deletion is complete, including the date
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: '12px 0 0' }}>
          The grace period exists deliberately. Account closure is easy to trigger and impossible to undo — 30 days gives
          you time to change your mind or retrieve something you forgot.
        </p>
      </LegalSection>

      <LegalSection title="What we retain, and why">
        <p style={{ margin: '0 0 12px' }}>After deletion we may retain a limited set of records:</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li style={{ marginBottom: 10 }}>
            Billing and payment records — retained as required by tax and accounting law. These include invoice amounts,
            dates and payment status for your subscription. They do not include your business data.
          </li>
          <li style={{ marginBottom: 10 }}>
            Records required by law — anything we are legally obliged to keep, or that is subject to a legal hold, for as
            long as that obligation lasts.
          </li>
          <li style={{ marginBottom: 10 }}>
            Aggregate, non-identifying statistics — for example, total platform usage counts that cannot be traced back to
            you or your customers.
          </li>
        </ul>
        <p style={{ margin: '12px 0 0' }}>
          We do not retain your customers, invoices, products, accounting entries, or any other business data after the
          deletion window closes.
        </p>
      </LegalSection>

      <LegalSection title="Deletion of individual records">
        <p style={{ margin: 0 }}>
          You do not need to close your account to delete individual data. Within the Service you can delete or deactivate
          customers, products, and other records yourself, subject to accounting integrity rules — for example, a posted
          journal entry cannot simply be erased, because doing so would break the audit trail. In those cases the correct
          action is a reversing entry, which the Service supports.
        </p>
      </LegalSection>

      <LegalSection title="Requests from your customers">
        <p style={{ margin: 0 }}>
          If one of your customers exercises a data right — asking what you hold about them, or asking for deletion — that
          request goes to you, not to us. You are the controller of that data. We will assist you in responding; contact
          info@soltol.com.
        </p>
      </LegalSection>

      <LegalSection title="How to request deletion">
        <p style={{ margin: '0 0 12px' }}>
          Email info@soltol.com from the account&apos;s registered email address, stating the company name and that you
          wish to close the account and delete your data. We will confirm within 2 business days and begin the timeline
          above.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          This document has not yet been reviewed by legal counsel. Retention periods stated here reflect Soltol LLC&apos;s
          operational commitments and may be adjusted to comply with applicable law in the State of New York, United States.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
