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
      updated="April 24, 2026"
      lead="This policy explains what information we collect, how we use it, who we share it with, and the choices you have."
    >
      <h2>Summary</h2>
      <ul>
        <li>We collect only what we need to ship orders and run the site.</li>
        <li>We never sell your information.</li>
        <li>
          We use a small number of trusted subprocessors (Squadco, PayPal,
          Resend, Supabase, Vercel) to operate the service.
        </li>
        <li>
          Analytics and non-essential cookies are strictly opt-in — you choose
          in the consent banner the first time you visit.
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
          <strong>Cookies</strong> — see the dedicated section below. We
          don&apos;t run third-party ad trackers or build cross-site ad
          profiles.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use a small, named set of cookies. Nothing is set for advertising
        purposes. The consent banner on your first visit is where you control
        the optional ones.
      </p>
      <h3>Strictly necessary (always on)</h3>
      <ul>
        <li>
          <strong>pxm_age_gate_accepted</strong> — records that you confirmed
          you are 21+ and accepted the research-use-only terms. Stored for one
          year so you aren&apos;t prompted on every visit. Without it the site
          is unusable, so this one cannot be declined.
        </li>
        <li>
          <strong>Session / authentication cookies</strong> — set by Supabase
          to keep you signed in. Expire when you log out or after a period of
          inactivity.
        </li>
        <li>
          <strong>Cart cookie</strong> — so the items in your cart persist
          between visits. Holds product IDs and quantities only, no personal
          data.
        </li>
        <li>
          <strong>Attribution cookie</strong> — a first-party record of the
          referral source (e.g. the campaign link you clicked to arrive) so we
          can credit partners and diagnose broken funnels. First-party only,
          never shared with ad networks.
        </li>
      </ul>
      <h3>Optional (opt-in via the consent banner)</h3>
      <ul>
        <li>
          <strong>pxm_cookie_consent</strong> — remembers your Accept / Reject
          choice from the banner so we don&apos;t ask again for a year. Set
          regardless of which option you pick (even &ldquo;Reject&rdquo;), so
          it counts as strictly necessary once a choice exists.
        </li>
        <li>
          <strong>Vercel Analytics</strong> — aggregated, cookieless page-view
          analytics provided by Vercel. Loaded <em>only</em> if you click
          &ldquo;Accept&rdquo; and only in production. Reports are anonymized
          and never tied to your account or order history.
        </li>
      </ul>
      <p>
        You can change your mind any time by clearing the{" "}
        <code>pxm_cookie_consent</code> cookie in your browser — the banner
        will reappear on your next visit.
      </p>

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
          <strong>Squadco</strong> — card processing. Card details are entered
          directly on Squadco&apos;s PCI-compliant payment page; we never see
          or store your full card number.
        </li>
        <li>
          <strong>PayPal</strong> — alternate checkout. Only your order number,
          total, and shipping address are shared with PayPal when you choose
          that rail.
        </li>
        <li>
          <strong>Resend</strong> — transactional and newsletter email delivery.
        </li>
        <li>
          <strong>Supabase</strong> — database and authentication.
        </li>
        <li>
          <strong>Vercel</strong> — hosting, logs, and (if you opt in) the
          anonymized analytics described above.
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
