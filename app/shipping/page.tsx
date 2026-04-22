import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"

export const metadata: Metadata = {
  title: "Shipping — PeptideXM",
  description:
    "Domestic 2–3 day shipping, discreet packaging, cold chain on temperature-sensitive peptides, and free shipping over $200.",
}

export default function ShippingPage() {
  return (
    <LegalPage
      title="Shipping"
      lead="Fast, discreet, temperature-controlled delivery on every order."
    >
      <h2>Processing</h2>
      <p>
        Orders placed by <strong>2:00 PM ET Monday–Friday</strong> ship the same
        business day. Orders placed after the cutoff or on weekends ship the
        next business day. You&apos;ll get a tracking number by email the moment
        the label is printed.
      </p>

      <h2>Domestic (United States)</h2>
      <ul>
        <li>
          <strong>Standard</strong> — USPS Priority Mail, 2–3 business days,{" "}
          <strong>$9 flat</strong>
        </li>
        <li>
          <strong>Expedited</strong> — UPS Next Day Air, 1 business day, $40
        </li>
        <li>
          <strong>Free standard shipping</strong> on orders over $200
        </li>
      </ul>

      <h2>Cold chain</h2>
      <p>
        Temperature-sensitive peptides — our XM-series metabolic line, IGF-1
        LR3, GHK-Cu, and blends — ship in insulated mailers with reusable gel
        ice packs sized for 2–3 day transit. We recommend refrigerating on
        arrival. If you anticipate being away at delivery, reply to your order
        confirmation and we&apos;ll hold the shipment up to seven days at no
        charge.
      </p>

      <h2>Discreet packaging</h2>
      <p>
        Every order ships in a plain outer box with a generic return address.
        There is no branding, product name, or research terminology on the
        exterior.
      </p>

      <h2>International</h2>
      <p>
        We currently ship to Canada, the UK, the EU, Australia, and New Zealand
        via DHL Express (3–6 business days). The customer is responsible for
        any import duties, VAT, or customs fees assessed by the destination
        country. We declare contents accurately as research chemicals and cannot
        under-declare value. Some compounds — notably GLP-1 analogs — are
        restricted in specific jurisdictions; if your country flags an item at
        customs, we&apos;ll refund your order in full once the seizure notice
        is confirmed.
      </p>

      <h2>Lost, damaged, or warm shipments</h2>
      <p>
        If tracking stalls for more than five business days, a package arrives
        visibly damaged, or a cold-chain shipment arrives fully thawed with
        melted ice packs: photograph the packaging and contents before opening
        and email{" "}
        <a href="mailto:peptidexm@gmail.com">peptidexm@gmail.com</a>. We&apos;ll
        ship a replacement or issue a refund at our cost.
      </p>

      <h2>Addresses and correction</h2>
      <p>
        We ship to the address on the order. Please double-check before
        checkout — once a label is generated we can&apos;t always intercept it.
        If you notice a mistake immediately, reply to your confirmation email
        and we&apos;ll update the label if the package hasn&apos;t been picked
        up yet.
      </p>
    </LegalPage>
  )
}
