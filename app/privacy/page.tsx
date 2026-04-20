import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy — PeptideXM",
  description:
    "How PeptideXM collects, uses, and protects your information. We collect only what's required to fulfill orders and improve the site.",
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="April 20, 2026"
      lead="This policy explains what information we collect, how we use it, who we share it with, and the choices you have."
    >
      <h2>Summary</h2>
      <ul>
        <li>We collect only what we need to ship orders and run the site.</li>
        <li>We never sell your information.</li>
        <li>
          We use a small number of trusted subprocessors (Stripe, Resend,
          Supabase, Vercel) to operate the service.
        </li>
        <li>
          You can request a copy of your data or have it deleted at any time.
        </li>
      </ul>

      <h2>Information we collect</h2>
      <h3>You give us</h3>
      <ul>
        <li>
          <strong>Account</strong> — name, email, and password hash (we never
          see your plaintext password).
        </li>
        <li>
          <strong>Orders</strong> — shipping address, items purchased, order
          notes.
        </li>
        <li>
          <strong>Support</strong> — anything you send us through the contact
          form or by email.
        </li>
      </ul>
      <h3>Collected automatically</h3>
      <ul>
        <li>
          <strong>Usage</strong> — pages viewed, product clicks, aggregate
          session data. Used to improve the site.
        </li>
        <li>
          <strong>Device</strong> — browser type, OS, approximate location
          derived from IP (city-level, not precise).
        </li>
        <li>
          <strong>Cookies</strong> — a session cookie to keep you signed in and
          a cart cookie so items persist between visits. We don&apos;t run
          third-party ad trackers.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>Process and ship orders, provide COAs, answer support requests.</li>
        <li>
          Send transactional email (order confirmation, shipping, cart
          recovery) and — if you opt in — the newsletter.
        </li>
        <li>Detect fraud and abuse.</li>
        <li>
          Improve the product catalog and site experience. Analytics is
          aggregated — we don&apos;t build individual ad profiles.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We share only what is necessary for a specific service, and only with
        providers bound by data-processing agreements:
      </p>
      <ul>
        <li>
          <strong>Stripe</strong> — card processing. We never see or store your
          full card number.
        </li>
        <li>
          <strong>Resend</strong> — transactional and newsletter email delivery.
        </li>
        <li>
          <strong>Supabase</strong> — database and authentication.
        </li>
        <li>
          <strong>Vercel</strong> — hosting and logs.
        </li>
        <li>
          <strong>Shipping carriers</strong> (USPS, UPS, DHL) — to deliver your
          order.
        </li>
      </ul>
      <p>
        We will also disclose information if compelled by lawful process, but
        we will push back on overbroad requests and notify you where legally
        permitted.
      </p>

      <h2>Retention</h2>
      <p>
        Order records are retained for seven years to comply with tax and
        consumer-protection law. Support correspondence is retained for three
        years. If you delete your account, we anonymize personal identifiers
        against those records rather than deleting the financial history
        outright.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          <strong>Access / export</strong> — email{" "}
          <a href="mailto:peptidexm@gmail.com">peptidexm@gmail.com</a> and we
          will send you a copy of your data within 30 days.
        </li>
        <li>
          <strong>Correction</strong> — update your account details at any time
          from your profile.
        </li>
        <li>
          <strong>Deletion</strong> — ask us to delete your account; we&apos;ll
          remove what we can and anonymize the rest.
        </li>
        <li>
          <strong>Marketing opt-out</strong> — every newsletter includes a
          one-click unsubscribe.
        </li>
      </ul>

      <h2>Regional rights</h2>
      <p>
        If you are in California, the EEA, or the UK, you have additional
        rights under the CCPA, GDPR, and UK GDPR — including the right to
        object to processing, the right to data portability, and the right to
        lodge a complaint with your supervisory authority. To exercise any of
        these rights, email us and reference the right you&apos;re invoking.
      </p>

      <h2>Children</h2>
      <p>
        PeptideXM is intended for qualified researchers over 21 years of age.
        We do not knowingly collect information from anyone under 21. If you
        believe a minor has submitted information, email us and we&apos;ll
        delete it.
      </p>

      <h2>Security</h2>
      <p>
        We use HTTPS everywhere, hash passwords with bcrypt, restrict database
        access with row-level security, and limit production access on a
        need-to-know basis. No system is perfectly secure — if we ever suffer a
        breach affecting your data, we&apos;ll notify you promptly per
        applicable law.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy from time to time. Material changes will be
        announced by email and by a notice on the site at least 30 days before
        taking effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email{" "}
        <a href="mailto:peptidexm@gmail.com">peptidexm@gmail.com</a>.
      </p>
    </LegalPage>
  )
}
