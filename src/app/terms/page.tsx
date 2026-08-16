import type { Metadata } from 'next';
import { LegalH2, LegalHr, LegalP, LegalPageLayout, LegalUl } from '@/components/legal/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Kamai, operated by Kamai Technologies.',
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="August 9, 2026">
      <LegalP>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of Kamai (the
        &quot;Service&quot;), operated by <strong>Kamai Technologies</strong>{' '}
        (Udyam Registration No. UDYAM-WB-14-0292371), currently a sole proprietorship, to be
        updated upon
        incorporation as a private limited company (&quot;Kamai,&quot; &quot;we,&quot;
        &quot;us,&quot; or &quot;our&quot;). By creating an account or using the Service, you
        agree to these Terms.
      </LegalP>
      <LegalP>If you do not agree, do not use the Service.</LegalP>

      <LegalHr />

      <LegalH2>1. What Kamai Is</LegalH2>
      <LegalP>
        Kamai is a business operations platform for home bakers and small bakery businesses in
        India, providing order management, customer records, billing and receipts, and related
        tools. Kamai may also connect you to wholesale ingredient and packaging suppliers through
        a separate procurement feature, where available.
      </LegalP>
      <LegalP>
        Kamai is a tool to help you run your business. Kamai is not a party to transactions
        between you and your customers, and is not a party to transactions between you and any
        wholesale supplier accessed through the Service.
      </LegalP>

      <LegalH2>2. Eligibility and Accounts</LegalH2>
      <LegalUl>
        <li>
          You must be at least 18 years old and legally able to enter into a contract under
          Indian law to use the Service.
        </li>
        <li>
          You are responsible for the accuracy of the information you provide and for maintaining
          the confidentiality of your account credentials.
        </li>
        <li>You are responsible for all activity that occurs under your account.</li>
        <li>You may log out or delete your account at any time through the app.</li>
      </LegalUl>

      <LegalH2>3. Subscription, Trial, and Billing</LegalH2>
      <LegalUl>
        <li>
          Kamai is offered on a free trial basis for new accounts, followed by a paid
          subscription. Current trial length and pricing are shown in-app at signup and on the
          billing screen, and may change over time with notice to existing subscribers regarding
          any price change.
        </li>
        <li>
          Paid subscriptions are billed via <strong>UPI AutoPay</strong> through Razorpay, our
          payment processor, on a recurring monthly basis until cancelled.
        </li>
        <li>
          You can cancel your subscription at any time from the billing screen. Cancellation
          stops future billing; it does not automatically refund amounts already charged.
        </li>
        <li>
          Unless required by law or stated otherwise at the time of purchase,{' '}
          <strong>payments already made are non-refundable.</strong>
        </li>
        <li>
          If a scheduled payment fails, we may retry the charge, notify you, and/or restrict
          write access to the Service (see Section 5) until payment succeeds or your subscription
          is cancelled.
        </li>
        <li>
          We do not store your card, UPI, or bank details. Payment information is collected and
          processed directly by Razorpay, our PCI-DSS compliant payment processor, under
          Razorpay&apos;s own terms and privacy policy.
        </li>
      </LegalUl>

      <LegalH2>4. Your Data and Content</LegalH2>
      <LegalUl>
        <li>
          You retain ownership of the business data you enter into Kamai — including your orders,
          customer contact details, pricing, and financial records (&quot;Your Data&quot;).
        </li>
        <li>
          You are solely responsible for the accuracy of Your Data and for having the right to
          store your customers&apos; contact information in Kamai. You confirm that you have
          appropriate consent from your customers to store and use their contact details for the
          purpose of fulfilling and communicating about their orders.
        </li>
        <li>
          We do not sell Your Data. See our Privacy Policy for details on what we collect and how
          it is used.
        </li>
        <li>
          If your account is cancelled or your subscription lapses, Your Data remains associated
          with your account as described in our Privacy Policy and Section 5 below; it is not
          deleted solely due to non-payment.
        </li>
      </LegalUl>

      <LegalH2>5. What Happens When a Trial Ends or a Subscription Lapses</LegalH2>
      <LegalP>
        If your free trial ends or your paid subscription lapses without renewal:
      </LegalP>
      <LegalUl>
        <li>
          You retain <strong>read-only access</strong> to your existing orders, customer records,
          and financial history within the Service.
        </li>
        <li>
          You will not be able to create or edit orders, add or edit customers, record payments,
          or send customer-facing communications (such as receipts or menu links) until you
          resubscribe.
        </li>
        <li>
          You may request full account deletion at any time, including in this state, through
          Settings or by contacting support.
        </li>
      </LegalUl>

      <LegalH2>6. Wholesale Procurement Features</LegalH2>
      <LegalP>
        Where Kamai connects you with third-party wholesale suppliers, Kamai facilitates the
        connection and order flow but is not a party to the underlying supply agreement between
        you and the supplier. Pricing, fulfilment, quality, and delivery are the responsibility of
        the supplier. Disputes regarding a specific order should first be raised directly with the
        supplier; contact Kamai support if you need help escalating.
      </LegalP>

      <LegalH2>7. Acceptable Use</LegalH2>
      <LegalP>You agree not to:</LegalP>
      <LegalUl>
        <li>
          Use the Service for any unlawful purpose, or to store or transmit content that is
          fraudulent, defamatory, or infringes another party&apos;s rights.
        </li>
        <li>
          Attempt to interfere with, disrupt, or gain unauthorized access to the Service or other
          users&apos; accounts or data.
        </li>
        <li>
          Use automated means to scrape or extract data from the Service without our written
          permission.
        </li>
      </LegalUl>
      <LegalP>We may suspend or terminate accounts that violate this section.</LegalP>

      <LegalH2>8. Service Availability</LegalH2>
      <LegalP>
        We aim to keep the Service available and reliable but do not guarantee uninterrupted
        access. The Service is provided &quot;as is,&quot; and we are not liable for losses
        arising from downtime, data loss due to circumstances outside our reasonable control, or
        third-party service failures (including Razorpay, Supabase, or other infrastructure
        providers we rely on).
      </LegalP>

      <LegalH2>9. Limitation of Liability</LegalH2>
      <LegalP>
        To the maximum extent permitted by Indian law, Kamai&apos;s total liability arising out of
        or related to your use of the Service is limited to the amount you paid to Kamai in the
        three (3) months preceding the claim. We are not liable for indirect, incidental, or
        consequential damages, including loss of business or profits.
      </LegalP>

      <LegalH2>10. Changes to the Service or These Terms</LegalH2>
      <LegalP>
        We may update these Terms or modify the Service over time. Material changes to these
        Terms will be communicated in-app or via the contact details associated with your account
        before they take effect. Continued use of the Service after changes take effect
        constitutes acceptance.
      </LegalP>

      <LegalH2>11. Termination</LegalH2>
      <LegalP>
        You may stop using the Service and delete your account at any time. We may suspend or
        terminate accounts that violate these Terms, with notice where reasonably possible.
      </LegalP>

      <LegalH2>12. Governing Law and Disputes</LegalH2>
      <LegalP>
        These Terms are governed by the laws of India. Any disputes arising from these Terms or
        your use of the Service will be subject to the exclusive jurisdiction of the courts of{' '}
        <strong>Kolkata, West Bengal</strong>, India.
      </LegalP>

      <LegalH2>13. Contact</LegalH2>
      <LegalP>Questions about these Terms, billing, or your account can be sent to:</LegalP>
      <LegalP>
        <strong>Email:</strong> getkamai.oms@gmail.com
        <br />
        <strong>WhatsApp/Phone:</strong> +91 98743 53532
      </LegalP>
    </LegalPageLayout>
  );
}
