import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Research Disclaimer — PeptideXM",
  description:
    "PeptideXM products are sold strictly for laboratory research use. They are not drugs, not supplements, and not intended for human consumption.",
}

export default function ResearchDisclaimerPage() {
  return (
    <LegalPage
      title="Research Disclaimer"
      lead="PeptideXM products are sold for laboratory research only. They are not drugs, not supplements, and not intended for human or veterinary consumption."
    >
      <h2>For research use only</h2>
      <p>
        All peptides, blends, and reagents offered on PeptideXM.com are sold
        exclusively for <strong>in vitro testing and non-clinical,
        non-human in vivo laboratory research</strong>. They are intended to
        be handled by qualified researchers trained in the safe handling of
        research chemicals, working in an appropriate laboratory setting.
      </p>

      <h2>Not for human or animal consumption</h2>
      <p>
        No product on this site is a drug, dietary supplement, cosmetic,
        medical device, or food. No product has been evaluated or approved by
        the FDA (or any comparable authority) for any human or veterinary
        use. <strong>Our products are not for injection, ingestion,
        inhalation, topical application, or any other administration to humans
        or animals.</strong>
      </p>

      <h2>No medical claims</h2>
      <p>
        Nothing on this site — including product names, descriptions, blog
        posts, customer reviews, or marketing copy — is a medical claim. No
        statement on this site should be interpreted as a recommendation to
        diagnose, treat, cure, mitigate, or prevent any disease or condition.
        Always consult a licensed medical professional for medical advice.
      </p>

      <h2>Your responsibilities</h2>
      <p>When you purchase from PeptideXM, you represent and warrant that:</p>
      <ul>
        <li>
          You are <strong>at least 21 years of age</strong> and have the legal
          capacity to enter into this agreement.
        </li>
        <li>
          You are a <strong>qualified researcher</strong> (or purchasing on
          behalf of a qualified entity) with the training and facilities
          necessary to handle research peptides safely.
        </li>
        <li>
          You will use products <strong>only for legitimate scientific
          research</strong> conducted under applicable institutional, local,
          state, national, and international laws and regulations.
        </li>
        <li>
          You will not administer any product to yourself, another human, or
          any animal in a non-research setting.
        </li>
        <li>
          You will not resell, relabel, or market any product as a therapeutic,
          cosmetic, or dietary product.
        </li>
        <li>
          You will obtain all applicable institutional review, ethics approval,
          or animal-use authorization required for your work.
        </li>
      </ul>

      <h2>Handling and safety</h2>
      <p>
        Research peptides should be handled with appropriate personal
        protective equipment (lab coat, gloves, eye protection) in a
        well-ventilated laboratory. Reconstitute and aliquot in sterile
        conditions. Store lyophilized powder desiccated at −20 °C and
        reconstituted peptide refrigerated at 2–8 °C, using per-peptide
        stability windows. Dispose of unused material in accordance with your
        institution&apos;s chemical-waste protocol.
      </p>

      <h2>Regulatory</h2>
      <p>
        Some peptides are controlled, scheduled, or restricted in certain
        jurisdictions. It is <strong>your responsibility</strong> to ensure
        possession, importation, and use of a given compound is lawful where
        you work. We do not ship compounds into jurisdictions where they are
        prohibited, and we will not under-declare shipment value or contents.
      </p>

      <h2>No liability for misuse</h2>
      <p>
        By purchasing from PeptideXM you expressly agree that you assume all
        risk and responsibility for any use of our products that falls outside
        the scope of laboratory research. To the fullest extent permitted by
        law, PeptideXM disclaims any liability for damages — direct, indirect,
        incidental, or consequential — arising out of any non-research use.
        See our <Link href="/terms">Terms of Service</Link> for full details.
      </p>

      <h2>Questions</h2>
      <p>
        If anything about a product or its intended research use is unclear,
        email <a href="mailto:peptidexm@gmail.com">peptidexm@gmail.com</a>{" "}
        before ordering. We&apos;d rather answer a question than sell into a
        misunderstanding.
      </p>
    </LegalPage>
  )
}
