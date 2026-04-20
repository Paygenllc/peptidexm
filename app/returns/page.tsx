import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Returns & Refunds — PeptideXM",
  description:
    "Opened sterile vials can't be returned for safety reasons, but we replace or refund anything damaged, warm on arrival, or materially off-spec.",
}

export default function ReturnsPage() {
  return (
    <LegalPage
      title="Returns &amp; refunds"
      lead="We stand behind every lot. If something arrives wrong, damaged, or off-spec, we make it right at our cost."
    >
      <h2>Sterile-product policy</h2>
      <p>
        Because peptides are sterile research materials, we <strong>cannot
        accept returns on opened or tampered vials</strong> — once the seal is
        broken there is no way to verify the contents upstream of the next
        researcher. This is standard practice across the industry and exists to
        protect the integrity of the supply.
      </p>
      <p>
        <strong>Unopened, sealed vials</strong> may be returned within{" "}
        <strong>30 days of delivery</strong> for a refund of the product price,
        minus a 15% restocking fee and the original shipping cost. Buyer pays
        return shipping. Email us for an RMA before sending anything back.
      </p>

      <h2>Damaged or lost in transit</h2>
      <p>
        If a package arrives visibly damaged, the ice packs are fully melted on
        a cold-chain shipment, or the vial is cracked or leaking:
      </p>
      <ol>
        <li>Photograph the outer box, the ice packs, and the vial.</li>
        <li>
          Email{" "}
          <a href="mailto:peptidexm@gmail.com">peptidexm@gmail.com</a> within 72
          hours of delivery with the photos and your order number.
        </li>
        <li>
          We&apos;ll ship a free replacement or issue a full refund —
          your choice.
        </li>
      </ol>

      <h2>Off-spec material</h2>
      <p>
        If an independent assay shows a lot falls materially short of the purity
        on its COA — send us the analytical data (method, chromatogram, MS
        trace) and the lot number. We&apos;ll re-test the retained sample
        from the same lot. If our retain confirms the deviation, you get a full
        refund plus replacement at no charge, and we pull the remainder of the
        lot from inventory.
      </p>

      <h2>Wrong item shipped</h2>
      <p>
        Pick errors happen — rarely, but they happen. If you receive the wrong
        product, email us and we&apos;ll overnight the correct item. Keep the
        mis-shipped vial; we&apos;ll include a prepaid return label in the
        replacement shipment.
      </p>

      <h2>Cancellations</h2>
      <p>
        Orders can be cancelled for a full refund any time before the label is
        printed. Once a tracking number has been generated we can no longer
        cancel, but you can refuse delivery and we&apos;ll refund the product
        total minus return-shipping cost on arrival.
      </p>

      <h2>How refunds are issued</h2>
      <p>
        Refunds are credited to the original payment method. Card refunds
        typically appear within 3–5 business days; bank transfers may take up
        to 10 business days depending on your institution.
      </p>

      <h2>Questions</h2>
      <p>
        Any situation that doesn&apos;t fit the buckets above — just write us at{" "}
        <a href="mailto:peptidexm@gmail.com">peptidexm@gmail.com</a>. We&apos;d
        rather solve one edge case fairly than lose a researcher over a
        technicality.
      </p>
    </LegalPage>
  )
}
