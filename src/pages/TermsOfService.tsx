import LegalDocumentLayout, { LegalBulletList, LegalSection } from './legal/LegalDocumentLayout';

export default function TermsOfService() {
  return (
    <LegalDocumentLayout
      title="Terms of Service"
      intro={
        <>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the SOLTOL ONE platform (&quot;SOLTOL,&quot;
          the &quot;Service&quot;), operated by [LEGAL_ENTITY] (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an account,
          accessing, or using the Service, you agree to these Terms. If you are entering into these Terms on behalf of a
          business (&quot;Tenant&quot;), you represent that you are authorized to bind that business.
          <br />
          <br />
          If you do not agree to these Terms, do not use the Service.
        </>
      }
    >
      <LegalSection title="1. The Service">
        <p style={{ margin: 0 }}>
          SOLTOL is a multi-tenant software-as-a-service platform for managing distribution operations, including customers,
          suppliers, invoicing, payments, inventory, accounting, field delivery, and related functions. We may add, change, or
          remove features over time.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts and eligibility">
        <LegalBulletList
          items={[
            'You must provide accurate registration information and keep it current.',
            'You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.',
            <>You must notify us promptly at [CONTACT_EMAIL] of any unauthorized use of your account.</>,
            'The Service is intended for business use by individuals aged 18 or older.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Tenant Data and ownership">
        <LegalBulletList
          items={[
            <>Your data is yours. As between you and us, the Tenant owns all data it enters into or generates through the Service (&quot;Tenant Data&quot;).</>,
            'You grant us a limited license to host, process, transmit, and display Tenant Data solely to provide and support the Service.',
            'You are responsible for the accuracy, legality, and quality of Tenant Data, and for having the necessary rights and lawful basis to store and process any personal information it contains (including information about your own customers and employees).',
            'Our handling of personal information is described in our Privacy Policy.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p style={{ margin: '0 0 12px' }}>You agree not to:</p>
        <LegalBulletList
          items={[
            'Use the Service in violation of any applicable law or regulation.',
            <>Upload or transmit malicious code, or attempt to gain unauthorized access to the Service, other Tenants&apos; data, or our systems.</>,
            'Interfere with or disrupt the integrity or performance of the Service.',
            'Reverse engineer, resell, or sublicense the Service except as expressly permitted.',
            'Use the Service to store or transmit content that infringes the rights of others.',
          ]}
        />
        <p style={{ margin: '12px 0 0' }}>We may suspend or terminate access for violations of this section.</p>
      </LegalSection>

      <LegalSection title="5. Subscription, trials, and billing">
        <LegalBulletList
          items={[
            'The Service may be offered on a free trial and/or paid subscription basis. Applicable plans, prices, and limits are presented at sign-up or in the Service.',
            'Paid subscriptions are billed through our third-party payment processor. By subscribing, you authorize recurring charges in accordance with your selected plan until you cancel.',
            'Fees are non-refundable except where required by law or expressly stated.',
            'We may change pricing or plan features on reasonable notice; changes apply to subsequent billing periods.',
            'If payment fails, we may suspend or limit access until the amount due is paid.',
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Third-party services">
        <p style={{ margin: 0 }}>
          The Service integrates with third-party providers (for example payment processing, AI processing, transcription,
          hosting, and storage). Your use of those features may be subject to the third parties&apos; own terms. We are not
          responsible for third-party services we do not control.
        </p>
      </LegalSection>

      <LegalSection title="7. Availability and support">
        <p style={{ margin: 0 }}>
          We aim to keep the Service available and reliable but do not guarantee uninterrupted or error-free operation. The
          Service is provided on an &quot;as available&quot; basis. We may perform maintenance, updates, or changes that
          temporarily affect availability.
        </p>
      </LegalSection>

      <LegalSection title="8. Suspension and termination">
        <LegalBulletList
          items={[
            <>You may stop using the Service and request account closure at any time by contacting [CONTACT_EMAIL].</>,
            'We may suspend or terminate your access if you breach these Terms, fail to pay fees, or use the Service in a way that risks harm to us, other Tenants, or third parties.',
            'Upon termination, your right to use the Service ends. We will make Tenant Data available for export for a reasonable period as described in our Privacy Policy or the Service, after which we may delete it in accordance with our retention practices.',
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Intellectual property">
        <p style={{ margin: 0 }}>
          The Service, including its software, design, and content (excluding Tenant Data), is owned by [LEGAL_ENTITY] and
          its licensors and is protected by intellectual property laws. These Terms do not grant you any rights in the Service
          except the limited right to use it as described.
        </p>
      </LegalSection>

      <LegalSection title="10. Disclaimers">
        <p style={{ margin: 0 }}>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR
          IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
          WARRANT THAT THE SERVICE WILL MEET YOUR REQUIREMENTS OR THAT IT WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. SOLTOL
          IS A TOOL TO ASSIST WITH BUSINESS OPERATIONS AND ACCOUNTING; IT IS NOT A SUBSTITUTE FOR PROFESSIONAL ACCOUNTING,
          TAX, OR LEGAL ADVICE, AND YOU ARE RESPONSIBLE FOR VERIFYING THE ACCURACY OF YOUR RECORDS.
        </p>
      </LegalSection>

      <LegalSection title="11. Limitation of liability">
        <p style={{ margin: 0 }}>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, [LEGAL_ENTITY] WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS, ARISING OUT OF OR
          RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE
          AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
        </p>
      </LegalSection>

      <LegalSection title="12. Indemnification">
        <p style={{ margin: 0 }}>
          You agree to indemnify and hold harmless [LEGAL_ENTITY] from claims, damages, and expenses arising out of your
          Tenant Data, your use of the Service, or your violation of these Terms or applicable law.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to these Terms">
        <p style={{ margin: 0 }}>
          We may update these Terms from time to time. When we make material changes, we will update the &quot;Last updated&quot;
          date and, where appropriate, notify Tenants through the Service. Your continued use of the Service after changes
          take effect constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="14. Governing law">
        <p style={{ margin: 0 }}>
          These Terms are governed by the laws of [JURISDICTION], without regard to its conflict-of-laws principles. Any
          disputes will be subject to the courts located in [JURISDICTION], unless otherwise required by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="15. Contact">
        <p style={{ margin: '0 0 12px' }}>Questions about these Terms can be sent to:</p>
        <p style={{ margin: 0 }}>
          [LEGAL_ENTITY]
          <br />
          Email: [CONTACT_EMAIL]
        </p>
        <p style={{ margin: '16px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          This document is a general first draft provided for launch readiness and does not constitute legal advice. Have it
          reviewed by qualified legal counsel in [JURISDICTION] before relying on it.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  );
}
