import type { Metadata } from 'next';
import {
  LegalH2,
  LegalHr,
  LegalP,
  LegalPageLayout,
  LegalTable,
  LegalUl,
} from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Kamai, operated by Kamai Technologies.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="August 9, 2026">
      <LegalP>
        This Privacy Policy explains how <strong>Kamai Technologies</strong>{' '}
        (Udyam Registration No. UDYAM-WB-14-0292371), currently a sole proprietorship, to be
        updated upon
        incorporation as a private limited company (&quot;Kamai,&quot; &quot;we,&quot;
        &quot;us&quot;) collects, uses, stores, and protects information when you use the Kamai
        platform (the &quot;Service&quot;).
      </LegalP>

      <LegalHr />

      <LegalH2>1. Information We Collect</LegalH2>
      <LegalP>
        <strong>Account information you provide:</strong>
      </LegalP>
      <LegalUl>
        <li>Name, phone number, email address (used for OTP-based login)</li>
        <li>Business details (business name, business type)</li>
      </LegalUl>

      <LegalP>
        <strong>Business data you enter into the Service:</strong>
      </LegalP>
      <LegalUl>
        <li>Orders, order items, and pricing</li>
        <li>
          Your customers&apos; names and contact details, entered by you to manage orders and
          send receipts
        </li>
        <li>Expense and payment records you log</li>
        <li>Menu items, photos, and pricing you upload for your shareable menu link</li>
      </LegalUl>

      <LegalP>
        <strong>Payment information:</strong>
      </LegalP>
      <LegalUl>
        <li>
          We do <strong>not</strong> collect or store your card, UPI ID, or bank account details.
          Payments and UPI AutoPay mandates are processed directly by <strong>Razorpay</strong>,
          our payment processor, under Razorpay&apos;s own privacy policy and PCI-DSS compliant
          systems. We receive confirmation of payment status (success/failure, subscription
          status) but not your underlying payment credentials.
        </li>
      </LegalUl>

      <LegalP>
        <strong>Usage information:</strong>
      </LegalP>
      <LegalUl>
        <li>
          Basic app usage and diagnostic data (e.g., feature usage, error logs) to help us fix
          bugs and improve the Service.
        </li>
      </LegalUl>

      <LegalP>
        <strong>Wholesale procurement data (where applicable):</strong>
      </LegalP>
      <LegalUl>
        <li>
          Order and catalogue interaction data between you and wholesale suppliers connected
          through the Service.
        </li>
      </LegalUl>

      <LegalH2>2. How We Use Your Information</LegalH2>
      <LegalP>We use the information above to:</LegalP>
      <LegalUl>
        <li>Provide and operate the Service — order management, receipts, billing, analytics</li>
        <li>Process your subscription payments via Razorpay</li>
        <li>Communicate with you about your account, billing, or support requests</li>
        <li>
          Generate your shareable menu link and receipts, which you choose to share with your own
          customers
        </li>
        <li>Improve the Service and diagnose technical issues</li>
        <li>Where you opt in, inform wholesale supply and demand matching between bakers and suppliers</li>
      </LegalUl>
      <LegalP>
        We do <strong>not</strong>{' '}
        sell Your Data to third parties, and we do not use your customers&apos; contact details
        for any purpose other than enabling the order and receipt features you use.
      </LegalP>

      <LegalH2>3. Who We Share Information With</LegalH2>
      <LegalP>
        We share information only with the service providers necessary to operate Kamai, under
        their own applicable data protection terms:
      </LegalP>
      <LegalTable>
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
            <th className="text-left px-4 py-2.5 font-serif font-bold text-[var(--text-primary)]">
              Provider
            </th>
            <th className="text-left px-4 py-2.5 font-serif font-bold text-[var(--text-primary)]">
              Purpose
            </th>
          </tr>
        </thead>
        <tbody className="text-[var(--text-secondary)]">
          <tr className="border-b border-[var(--border)]">
            <td className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">Razorpay</td>
            <td className="px-4 py-2.5">Payment processing, UPI AutoPay subscription billing</td>
          </tr>
          <tr className="border-b border-[var(--border)]">
            <td className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">Supabase</td>
            <td className="px-4 py-2.5">Database and file storage (photos, receipts)</td>
          </tr>
          <tr className="border-b border-[var(--border)]">
            <td className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">
              Google (Gemini)
            </td>
            <td className="px-4 py-2.5">
              AI-assisted catalogue/menu import from uploaded images or PDFs, where you use this
              feature
            </td>
          </tr>
          <tr>
            <td className="px-4 py-2.5 font-semibold text-[var(--text-primary)]">Authkey.io</td>
            <td className="px-4 py-2.5">OTP delivery for login</td>
          </tr>
        </tbody>
      </LegalTable>
      <LegalP>
        We do not share Your Data with advertisers or data brokers. We may disclose information
        if required by law, or to protect the rights, safety, or property of Kamai, our users, or
        the public.
      </LegalP>

      <LegalH2>4. Data Storage and Security</LegalH2>
      <LegalP>
        Your data is stored on Supabase infrastructure with industry-standard security practices.
        While we take reasonable steps to protect your information, no system is completely
        secure, and we cannot guarantee absolute security of data transmitted or stored.
      </LegalP>

      <LegalH2>5. Data Retention</LegalH2>
      <LegalUl>
        <li>
          We retain Your Data for as long as your account is active, and for a reasonable period
          after account inactivity or subscription lapse so you can resume access without losing
          your business history.
        </li>
        <li>
          If you request full account deletion, we will delete or anonymize your personal data
          and business records within a reasonable timeframe, except where we are required to
          retain certain records (e.g., transaction records) for legal, tax, or accounting
          purposes under Indian law.
        </li>
      </LegalUl>

      <LegalH2>6. Your Rights and Choices</LegalH2>
      <LegalP>You can, at any time:</LegalP>
      <LegalUl>
        <li>Access and review the data in your account directly through the app</li>
        <li>Correct inaccurate information in your account or business records</li>
        <li>Request full account and data deletion by contacting support or using the in-app option</li>
        <li>Log out or stop using the Service at any time</li>
      </LegalUl>

      <LegalH2>7. Your Customers&apos; Data</LegalH2>
      <LegalP>
        If you store your own customers&apos; contact information in Kamai to manage orders, you
        are responsible for ensuring you have the appropriate basis (e.g., consent, an existing
        customer relationship) to do so under applicable law. Kamai processes this data solely on
        your instructions, as your service provider, to enable order management and
        receipt-sharing features you control.
      </LegalP>

      <LegalH2>8. Children&apos;s Privacy</LegalH2>
      <LegalP>
        The Service is not directed at individuals under 18. We do not knowingly collect data
        from minors.
      </LegalP>

      <LegalH2>9. Grievance Officer</LegalH2>
      <LegalP>
        In accordance with the Information Technology Act, 2000 and applicable rules, the
        Grievance Officer for Kamai is:
      </LegalP>
      <LegalP>
        <strong>Name:</strong> Pritam, Founder, Kamai Technologies
        <br />
        <strong>Email:</strong> getkamai.oms@gmail.com
        <br />
        <strong>Phone:</strong> +91 98743 53532
        <br />
        <strong>Response timeline:</strong> We aim to acknowledge complaints within 24 hours and
        resolve them within 15 days.
      </LegalP>

      <LegalH2>10. Changes to This Policy</LegalH2>
      <LegalP>
        We may update this Privacy Policy from time to time. Material changes will be
        communicated in-app or via your registered contact details before they take effect.
      </LegalP>

      <LegalH2>11. Contact Us</LegalH2>
      <LegalP>For any questions about this Privacy Policy or how your data is handled:</LegalP>
      <LegalP>
        <strong>Email:</strong> getkamai.oms@gmail.com
        <br />
        <strong>WhatsApp/Phone:</strong> +91 98743 53532
      </LegalP>
    </LegalPageLayout>
  );
}
