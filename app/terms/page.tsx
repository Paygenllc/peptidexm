import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Terms of Service — PeptideXM",
  description:
    "The agreement between you and PeptideXM when you use the site or purchase research peptides.",
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="April 20, 2026"
      lead="By using PeptideXM.com or purchasing from us, you agree to these terms. Please read them carefully."
    >
      <h2>Who we are</h2>
      <p>
        PeptideXM (&ldquo;PeptideXM,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us&rdquo;) supplies research-grade peptides for in vitro and non-human in
        vivo research. These Terms form a binding agreement between you (the
        customer or site visitor) and PeptideXM.
      </p>

      <h2>Research-use-only</h2>
      <p>
        All products sold on this site are <strong>for laboratory research
        purposes only</strong>. They are not drugs, not dietary supplements,
        not cosmetics, and are not intended for human or veterinary
        consumption, diagnosis, treatment, cure, or prevention of any disease.
        You agree to use our products strictly in accordance with this
        restriction and to comply with all applicable laws, regulations, and
        institutional protocols governing research chemicals in your
        jurisdiction. See also our{" "}
        <Link href="/research-disclaimer">Research Disclaimer</Link>.
      </p>

      <h2>Eligibility</h2>
      <p>
        You represent and warrant that you are at least <strong>21 years
        old</strong>, legally able to enter into this agreement, and purchasing
        on behalf of yourself or an entity you have authority to bind for
        legitimate research activities.
      </p>

      <h2>Orders, pricing, and availability</h2>
      <ul>
        <li>
          All prices are in USD and exclude applicable taxes and duties.
        </li>
        <li>
          We may refuse or cancel any order — including after confirmation — if
          we suspect fraud, misuse, inventory error, or pricing mistake. In
          any such case we will refund the full amount charged.
        </li>
        <li>
          Product availability is not guaranteed. Descriptions and COAs are as
          accurate as we can make them; minor variations between lots are
          normal and documented on the lot-specific COA.
        </li>
      </ul>

      <h2>Payment</h2>
      <p>
        Payment is processed by our third-party payment providers. By placing
        an order you authorize PeptideXM and our payment providers to charge
        the payment method you select for the order total, including taxes
        and shipping. Chargebacks without first contacting us are a breach of
        these Terms and may result in account termination.
      </p>

      <h2>Shipping, returns, and quality</h2>
      <p>
        Shipping terms, transit times, damage handling, and return eligibility
        are set out on our <Link href="/shipping">Shipping</Link> and{" "}
        <Link href="/returns">Returns</Link> pages, which are incorporated into
        these Terms. Quality standards and COA practices are described on our{" "}
        <Link href="/quality">Quality</Link> page.
      </p>

      <h2>Account</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account
        credentials and for all activity on your account. Notify us immediately
        if you suspect unauthorized access. We reserve the right to suspend
        accounts that violate these Terms.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use any product in or on a human or animal for non-research purposes.</li>
        <li>Resell, relabel, or repackage our products as a therapeutic.</li>
        <li>
          Make medical, therapeutic, or performance claims in connection with
          our products or the PeptideXM brand.
        </li>
        <li>
          Circumvent rate limits, scrape the site at scale, or interfere with
          site operation.
        </li>
        <li>
          Use the site in violation of applicable export controls or sanctions.
        </li>
      </ul>

      <h2>Intellectual property</h2>
      <p>
        The PeptideXM name, logo, site content, product photography, and lot
        documentation are owned by PeptideXM and provided to you under a
        limited, non-transferable license for personal evaluation and lawful
        research. You may not reproduce, redistribute, or use them commercially
        without written permission.
      </p>

      <h2>Disclaimers</h2>
      <p>
        <strong>
          The products and site are provided &ldquo;as is&rdquo; without
          warranty of any kind, express or implied.
        </strong>{" "}
        To the fullest extent permitted by law we disclaim all implied
        warranties, including merchantability, fitness for a particular
        purpose, and non-infringement. We do not warrant that the site will be
        uninterrupted or error-free.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, PeptideXM&apos;s aggregate
        liability arising out of or related to these Terms or your use of the
        products or site is limited to the greater of $100 or the amount you
        paid us in the twelve months before the claim arose. We are not liable
        for indirect, incidental, consequential, special, punitive, or lost-
        profits damages, even if advised of the possibility.
      </p>

      <h2>Indemnity</h2>
      <p>
        You agree to indemnify and hold harmless PeptideXM, its officers,
        employees, and suppliers from any claims arising out of your misuse of
        our products, violation of these Terms, or violation of applicable law.
      </p>

      <h2>Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, United
        States, without regard to conflict-of-laws principles. Any dispute will
        be resolved by binding arbitration in Delaware under the rules of the
        American Arbitration Association, except that either party may bring a
        small-claims action in the appropriate court. <strong>You waive any
        right to participate in a class action.</strong>
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        posted on the site and, where we have your email, sent to you at least
        30 days before taking effect. Continued use after the effective date
        constitutes acceptance.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href="mailto:peptidexm@gmail.com">peptidexm@gmail.com</a>.
      </p>
    </LegalPage>
  )
}
