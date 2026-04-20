import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Quality & Purity — PeptideXM",
  description:
    "Every PeptideXM batch is third-party tested for identity, purity, and sterility. COAs are released with each lot and available on request.",
}

export default function QualityPage() {
  return (
    <LegalPage
      title="Built for research you can trust"
      lead="Reproducibility starts with the reagent. We test every lot, publish certificates of analysis, and reject anything that doesn't clear our spec — so your data isn't the variable."
    >
      <h2>Our quality standard</h2>
      <p>
        PeptideXM peptides are synthesized in FDA-registered and ISO 9001-certified
        facilities using solid-phase peptide synthesis (SPPS). Every batch is
        purified to <strong>≥ 98% purity</strong> by reverse-phase high-performance
        liquid chromatography (RP-HPLC) before it ships. Lots that fall below spec
        are rejected, not discounted.
      </p>

      <h2>Third-party analytical testing</h2>
      <p>
        We don&apos;t grade our own homework. Every batch is tested by an
        independent, ISO 17025-accredited analytical laboratory. A batch is
        released only when the independent panel matches our in-house
        qualification.
      </p>
      <ul>
        <li>
          <strong>RP-HPLC</strong> — purity and impurity profiling
        </li>
        <li>
          <strong>Mass spectrometry (ESI-MS / MALDI-TOF)</strong> — sequence and
          molecular-weight confirmation
        </li>
        <li>
          <strong>Water content (Karl Fischer)</strong> — residual moisture
          below pharmacopeial limits
        </li>
        <li>
          <strong>Acetate / TFA counter-ion content</strong> — so the peptide
          mass on the label is actual peptide
        </li>
        <li>
          <strong>Bacterial endotoxin (LAL)</strong> and bioburden for relevant
          compounds
        </li>
      </ul>

      <h2>Certificate of Analysis (COA)</h2>
      <p>
        A lot-specific COA is included with every shipment and permanently
        archived against the order. It contains the method, acceptance criteria,
        measured values, and the QC analyst&apos;s signature. If you need an
        older COA for audit or publication, email{" "}
        <a href="mailto:peptidexm@gmail.com">peptidexm@gmail.com</a> with the
        lot number and we&apos;ll send it within one business day.
      </p>

      <h2>Stability and cold chain</h2>
      <p>
        Lyophilized peptides are stored at −20 °C in moisture-controlled freezers
        and shipped in insulated packaging with ice packs. Temperature-sensitive
        products (GLP-1 analogs, IGF-1 LR3, GHK-Cu) ship with continuous ice
        coverage sufficient for standard 2–3 day transit. If a shipment is
        delayed and arrives warm, photograph the packaging on arrival and contact
        us — we&apos;ll replace or refund at our cost.
      </p>

      <h2>Traceability</h2>
      <p>
        Every vial carries a lot number that maps to the raw material batch,
        synthesis run, purification fraction, QC panel, and shipping record. If
        anything ever needs to be recalled, we know exactly where it went.
      </p>

      <h2>What we will never do</h2>
      <ul>
        <li>
          <strong>Relabel</strong> vials from another brand and sell them as ours
        </li>
        <li>
          <strong>Release</strong> a lot without a passing third-party panel
        </li>
        <li>
          <strong>Obfuscate</strong> counter-ion or water content to inflate
          apparent mg on the label
        </li>
        <li>
          <strong>Make</strong> therapeutic or clinical claims — these are
          research materials
        </li>
      </ul>

      <p>
        Have a specific methodological question or need to qualify a new lot for
        a study? Reach out and we&apos;ll walk you through the data.
      </p>
    </LegalPage>
  )
}
