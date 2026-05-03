import "server-only"
import { Resend } from "resend"
import { CONTACT_EMAIL } from "@/lib/contact"
import type { PaymentMethodKey } from "@/lib/payment-methods"

const FROM_EMAIL = process.env.EMAIL_FROM ?? "PeptideXM <noreply@peptidexm.com>"
// Broadcasts should come from a human-looking support address so replies land
// somewhere we actually read. Overridable via env for deploy flexibility.
const BROADCAST_FROM_EMAIL =
  process.env.BROADCAST_FROM_EMAIL ?? "PeptideXM <support@peptidexm.com>"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? CONTACT_EMAIL

let _resend: Resend | null | undefined

function getResend() {
  if (_resend !== undefined) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) {
    _resend = null
    return null
  }
  _resend = new Resend(key)
  return _resend
}

type SendArgs = {
  to: string | string[]
  subject: string
  html: string
  text: string
  replyTo?: string
  from?: string
}

export async function sendEmail({ to, subject, html, text, replyTo, from }: SendArgs) {
  const resend = getResend()
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping email to", to)
    return { skipped: true as const }
  }
  try {
    const res = await resend.emails.send({
      from: from ?? FROM_EMAIL,
      to,
      subject,
      html,
      text,
      replyTo,
    })
    if (res.error) {
      console.error("[email] send failed:", res.error)
      return { skipped: false as const, error: res.error }
    }
    return { skipped: false as const, id: res.data?.id }
  } catch (error) {
    console.error("[email] send threw:", error)
    return { skipped: false as const, error }
  }
}

// ---------- Templates ----------

/**
 * Welcome email with a personalized 10%-off coupon code.
 *
 * Single-purpose, plain template — we keep it short on purpose so it
 * lands in the primary inbox tab and doesn't trip Gmail's promotions
 * heuristics. The coupon code is rendered as a copy-friendly mono
 * block; the CTA button drops the visitor into /products with the
 * code in the URL hash so a future enhancement can auto-apply it.
 */
export async function sendWelcomeCouponEmail(input: {
  to: string
  code: string
  expiresAtIso?: string | null
}) {
  const expiry = input.expiresAtIso
    ? new Date(input.expiresAtIso).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null

  const html = shell(`
    <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;font-weight:500;color:#111827;">
      Welcome — here's 10% off your first order
    </h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
      Thanks for joining the journal. Your one-time discount code is below.
      Apply it at checkout to take 10% off your first order.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
      <tr><td style="padding:14px 18px;border:1px dashed ${borderColor};border-radius:8px;background:#faf7f3;font-family:Menlo,Consolas,monospace;font-size:18px;letter-spacing:0.04em;color:#111827;">
        ${input.code}
      </td></tr>
    </table>
    <p style="margin:0 0 24px;font-size:12px;color:${mutedText};">
      ${
        expiry
          ? `Valid for one use, single customer, until ${expiry}.`
          : "Valid for one use per customer."
      }
    </p>
    <a href="https://peptidexm.com/products" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;">
      Shop the catalog
    </a>
  `)

  const text = `Welcome — here's 10% off your first order

Your one-time code: ${input.code}
${expiry ? `Valid until ${expiry}.\n` : ""}
Apply it at checkout: https://peptidexm.com/products
`

  return sendEmail({
    to: input.to,
    subject: "Your 10% off code from PeptideXM",
    html,
    text,
  })
}


const brandColor = "#8b5e34" // warm terra cotta accent, matches site
const mutedText = "#6b7280"
const borderColor = "#e5e7eb"

function shell(inner: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f9f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${borderColor};border-radius:12px;overflow:hidden;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid ${borderColor};">
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:500;color:#111827;">PeptideXM</div>
          </td></tr>
          <tr><td style="padding:32px;">${inner}</td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid ${borderColor};font-size:12px;color:${mutedText};">
            Questions? Reply to this email or write to <a href="mailto:${CONTACT_EMAIL}" style="color:${brandColor};text-decoration:none;">${CONTACT_EMAIL}</a>.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

export type OrderEmailInput = {
  orderNumber: string
  total: number
  customerName: string
  customerEmail: string
  shippingAddress: string
  items: Array<{ name: string; variant: string; quantity: number; price: number }>
  /**
   * Which rail the shopper chose. Drives the entire subject line, the
   * "next step" block, the plain-text alternative, and the admin
   * notification — so card orders don't get "pending Zelle" copy,
   * PayPal orders don't get Zelle memo instructions, etc. Defaults
   * to `"zelle"` when undefined (the original pre-multi-rail behavior)
   * so existing callers that haven't been updated keep working.
   */
  paymentMethod?: PaymentMethodKey
}

/**
 * Human-readable labels for each payment rail. Kept here next to the
 * email templates because their phrasing is tuned for transactional
 * copy ("awaiting crypto" reads better than "awaiting cryptocurrency
 * payment"). Used for both subject lines and inline body references.
 */
const METHOD_LABEL: Record<PaymentMethodKey, string> = {
  card: "card",
  zelle: "Zelle",
  crypto: "crypto",
  paypal: "PayPal",
}

export async function sendOrderPlacedCustomerEmail(order: OrderEmailInput) {
  // Resolve the rail once so the whole template branches cleanly. Default
  // to Zelle for backward compatibility with older callers that may not
  // yet be passing `paymentMethod`.
  const method: PaymentMethodKey = order.paymentMethod ?? "zelle"

  // Subject line is the single most visible differentiator in the
  // inbox list — getting it wrong (e.g. "complete your Zelle payment"
  // on a card order) immediately destroys trust. Match it tightly
  // to the rail the shopper actually chose.
  const subjectByMethod: Record<PaymentMethodKey, string> = {
    zelle: `Order ${order.orderNumber} received — complete your Zelle payment`,
    card: `Order ${order.orderNumber} received — payment processing`,
    crypto: `Order ${order.orderNumber} received — complete your crypto payment`,
    paypal: `Order ${order.orderNumber} received — complete your PayPal payment`,
  }
  const subject = subjectByMethod[method]

  // One-line lead that sits directly under the greeting and sets
  // expectations for the next step.
  const leadByMethod: Record<PaymentMethodKey, string> = {
    zelle: `Your order <strong>${order.orderNumber}</strong> is confirmed. To finalize it, send payment via <strong>Zelle</strong> using the instructions below.`,
    card: `Your order <strong>${order.orderNumber}</strong> is confirmed. We're processing your card payment right now — we'll email you the moment it clears.`,
    crypto: `Your order <strong>${order.orderNumber}</strong> is confirmed. Finish sending your crypto transfer at the payment page — we'll email you as soon as the network confirms it.`,
    paypal: `Your order <strong>${order.orderNumber}</strong> is confirmed. Finish approving payment in PayPal — we'll email you as soon as it clears.`,
  }
  const leadHtml = leadByMethod[method]

  const leadTextByMethod: Record<PaymentMethodKey, string> = {
    zelle: `Your order is confirmed. To finalize it, send payment via Zelle using the instructions below.`,
    card: `Your order is confirmed. We're processing your card payment right now — we'll email you the moment it clears.`,
    crypto: `Your order is confirmed. Finish sending your crypto transfer at the payment page — we'll email you as soon as the network confirms it.`,
    paypal: `Your order is confirmed. Finish approving payment in PayPal — we'll email you as soon as it clears.`,
  }
  const leadTextOnly = leadTextByMethod[method]

  // The Zelle-details card and the "don't put product names in the
  // memo" warning are Zelle-specific — only render them on that rail.
  const zellePaymentBlockHtml =
    method === "zelle"
      ? `
    <div style="background:#fdf6ee;border:1px solid #ecd8c0;border-radius:10px;padding:20px;margin-bottom:24px;">
      <div style="font-size:12px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Zelle payment details</div>
      <div style="font-size:15px;margin-bottom:12px;"><strong>Send to:</strong> <a href="mailto:${CONTACT_EMAIL}" style="color:${brandColor};text-decoration:none;">${CONTACT_EMAIL}</a></div>
      <div style="font-size:15px;margin-bottom:12px;"><strong>Amount:</strong> $${order.total.toFixed(2)}</div>
      <div style="font-size:15px;margin-bottom:4px;"><strong>Memo / Note:</strong> <span style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:6px;border:1px solid ${borderColor};">${order.orderNumber}</span></div>
    </div>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-weight:600;color:#991b1b;margin-bottom:6px;">Important</div>
      <p style="margin:0;font-size:14px;color:#7f1d1d;line-height:1.5;">Use <strong>only</strong> your order number <strong>${order.orderNumber}</strong> in the Zelle memo. <strong>Do not</strong> include product names, "peptide", or any research terms — your order will be cancelled automatically and the payment refunded.</p>
    </div>
    `
      : ""

  // Closing line mirrors the lead's tone per rail. Zelle needs a
  // concrete follow-up action; automated rails just reassure the
  // shopper there's nothing more for them to do on the PeptideXM side.
  const closingByMethod: Record<PaymentMethodKey, string> = {
    zelle: `After sending payment, reply to this email with your Zelle confirmation number or submit it on your account page.`,
    card: `No further action needed — we'll ship as soon as your card payment clears.`,
    crypto: `No further action needed on our side. The crypto network typically confirms within a few minutes to an hour depending on the coin.`,
    paypal: `No further action needed — we'll ship as soon as PayPal finishes processing.`,
  }
  const closingCopy = closingByMethod[method]

  const itemsHtml = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid ${borderColor};">
            <div style="font-weight:500;">${escapeHtml(i.name)}</div>
            <div style="font-size:13px;color:${mutedText};">${escapeHtml(i.variant)} × ${i.quantity}</div>
          </td>
          <td align="right" style="padding:8px 0;border-bottom:1px solid ${borderColor};white-space:nowrap;">$${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`,
    )
    .join("")

  const itemsText = order.items
    .map((i) => `  • ${i.name} — ${i.variant} × ${i.quantity}  $${(i.price * i.quantity).toFixed(2)}`)
    .join("\n")

  const html = shell(`
    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;">Order received</p>
    <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:26px;font-weight:500;">Thanks, ${escapeHtml(order.customerName)}.</h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;">${leadHtml}</p>

    ${zellePaymentBlockHtml}

    <h2 style="margin:0 0 12px 0;font-size:16px;">Order summary</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:16px;">
      ${itemsHtml}
      <tr><td style="padding:12px 0 0 0;font-weight:600;">Total</td><td align="right" style="padding:12px 0 0 0;font-weight:600;">$${order.total.toFixed(2)}</td></tr>
    </table>

    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};">Shipping to</p>
    <p style="margin:0 0 24px 0;font-size:14px;white-space:pre-line;">${escapeHtml(order.shippingAddress)}</p>

    <p style="margin:0;font-size:14px;line-height:1.6;color:${mutedText};">${closingCopy}</p>
  `)

  // Plain-text alternative follows the same rail-gated structure as
  // the HTML. Only the Zelle branch embeds a payment-details block +
  // memo warning — other rails stay clean and reassuring.
  const zellePaymentBlockText =
    method === "zelle"
      ? `
To finalize it, send payment via Zelle:
  Send to: ${CONTACT_EMAIL}
  Amount: $${order.total.toFixed(2)}
  Memo / Note: ${order.orderNumber}

IMPORTANT: Use ONLY your order number (${order.orderNumber}) in the Zelle memo. Do NOT mention product names or any research terms — orders that include them will be cancelled automatically and the payment refunded.
`
      : ""

  const text = `PeptideXM — Order ${order.orderNumber} received

Thanks, ${order.customerName}. ${leadTextOnly}
${zellePaymentBlockText}
Order summary:
${itemsText}
  Total: $${order.total.toFixed(2)}

Shipping to:
${order.shippingAddress}

${closingCopy}

Questions? ${CONTACT_EMAIL}`

  return sendEmail({
    to: order.customerEmail,
    subject,
    html,
    text,
    replyTo: CONTACT_EMAIL,
  })
}

export type PaymentReminderInput = {
  orderNumber: string
  total: number
  customerName: string
  customerEmail: string
  /** Which reminder this is (1..3). Drives subject and copy escalation. */
  ordinal: 1 | 2 | 3
  /** How many calendar days ago the order was placed. Shown in copy. */
  daysSinceOrder: number
  /** Deep link back to the customer's account/order page for payment. */
  payUrl: string
}

/**
 * Payment reminder sent to customers who placed an order but never completed
 * the Zelle transfer. Tone escalates by ordinal: friendly nudge → firmer
 * reminder → final "cancellation coming" notice. Always includes the Zelle
 * memo and the rule about not mentioning product names, since that's the
 * #1 reason Zelle transfers get reversed.
 */
export async function sendPaymentReminderEmail(input: PaymentReminderInput) {
  const { orderNumber, total, customerName, customerEmail, ordinal, daysSinceOrder, payUrl } = input

  const subjects: Record<1 | 2 | 3, string> = {
    1: `Reminder: complete your Zelle payment for ${orderNumber}`,
    2: `Your PeptideXM order ${orderNumber} is still waiting for payment`,
    3: `Final notice: ${orderNumber} will be cancelled soon`,
  }

  const leads: Record<1 | 2 | 3, string> = {
    1: `Just a quick nudge — your order <strong>${orderNumber}</strong> was placed ${daysSinceOrder} day${daysSinceOrder === 1 ? "" : "s"} ago and we haven't received your Zelle yet. Send it whenever you're ready and we'll ship within 24 hours of confirmation.`,
    2: `Your order <strong>${orderNumber}</strong> has been waiting for payment for ${daysSinceOrder} days. We've held your items in reserve — but we can only do that a little longer. Please complete your Zelle transfer to release the order to fulfillment.`,
    3: `This is the final reminder for order <strong>${orderNumber}</strong>. It's been ${daysSinceOrder} days without payment, so we'll cancel the order and release the reserved stock soon. If you still want these items, complete your Zelle transfer now.`,
  }

  const leadsText: Record<1 | 2 | 3, string> = {
    1: `Just a quick nudge — your order ${orderNumber} was placed ${daysSinceOrder} day${daysSinceOrder === 1 ? "" : "s"} ago and we haven't received your Zelle yet. Send it whenever you're ready and we'll ship within 24 hours of confirmation.`,
    2: `Your order ${orderNumber} has been waiting for payment for ${daysSinceOrder} days. We've held your items in reserve — but we can only do that a little longer. Please complete your Zelle transfer to release the order to fulfillment.`,
    3: `This is the final reminder for order ${orderNumber}. It's been ${daysSinceOrder} days without payment, so we'll cancel the order and release the reserved stock soon. If you still want these items, complete your Zelle transfer now.`,
  }

  const html = shell(`
    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;">
      ${ordinal === 3 ? "Final payment reminder" : "Payment reminder"}
    </p>
    <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:26px;font-weight:500;">Hi ${escapeHtml(customerName)},</h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;">${leads[ordinal]}</p>

    <div style="background:#fdf6ee;border:1px solid #ecd8c0;border-radius:10px;padding:20px;margin-bottom:24px;">
      <div style="font-size:12px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Zelle payment details</div>
      <div style="font-size:15px;margin-bottom:12px;"><strong>Send to:</strong> <a href="mailto:${CONTACT_EMAIL}" style="color:${brandColor};text-decoration:none;">${CONTACT_EMAIL}</a></div>
      <div style="font-size:15px;margin-bottom:12px;"><strong>Amount:</strong> $${total.toFixed(2)}</div>
      <div style="font-size:15px;margin-bottom:4px;"><strong>Memo / Note:</strong> <span style="font-family:monospace;background:#fff;padding:2px 8px;border-radius:6px;border:1px solid ${borderColor};">${orderNumber}</span></div>
    </div>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-weight:600;color:#991b1b;margin-bottom:6px;">Important</div>
      <p style="margin:0;font-size:14px;color:#7f1d1d;line-height:1.5;">Use <strong>only</strong> your order number <strong>${orderNumber}</strong> in the Zelle memo. <strong>Do not</strong> include product names, "peptide", or any research terms — payments that mention them are returned automatically.</p>
    </div>

    <div style="text-align:center;margin:28px 0 24px;">
      <a href="${escapeHtml(payUrl)}" style="display:inline-block;background:${brandColor};color:#ffffff;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;">View my order →</a>
    </div>

    <p style="margin:0;font-size:13px;color:${mutedText};line-height:1.6;">Already sent the Zelle? Reply to this email with your confirmation code and we'll match it up today.</p>
  `)

  const text = `PeptideXM — ${ordinal === 3 ? "FINAL payment reminder" : "Payment reminder"} for ${orderNumber}

Hi ${customerName},

${leadsText[ordinal]}

ZELLE PAYMENT DETAILS
  Send to: ${CONTACT_EMAIL}
  Amount:  $${total.toFixed(2)}
  Memo:    ${orderNumber}

IMPORTANT: Use ONLY your order number (${orderNumber}) in the Zelle memo. Do NOT mention product names or any research terms — payments that do are returned automatically.

View your order: ${payUrl}

Already sent the Zelle? Reply to this email with your confirmation code.

Questions? ${CONTACT_EMAIL}`

  return sendEmail({
    to: customerEmail,
    subject: subjects[ordinal],
    html,
    text,
    replyTo: CONTACT_EMAIL,
  })
}

export async function sendOrderPlacedAdminEmail(order: OrderEmailInput) {
  const method: PaymentMethodKey = order.paymentMethod ?? "zelle"
  const methodLabel = METHOD_LABEL[method]

  // Admin inbox-glance phrase: the subject tag has to instantly signal
  // both the rail AND what action (if any) the admin still owes the
  // shopper. Zelle → "pending Zelle" (admin verifies the transfer).
  // Card/PayPal → "processing <rail>" (admin watches for the webhook).
  // Crypto → "awaiting crypto" (admin waits on on-chain confirmation).
  const subjectTagByMethod: Record<PaymentMethodKey, string> = {
    zelle: "pending Zelle",
    card: "processing card",
    crypto: "awaiting crypto",
    paypal: "processing PayPal",
  }
  const subject = `New order ${order.orderNumber} — $${order.total.toFixed(2)} (${subjectTagByMethod[method]})`

  // One-line summary below the order number, mirroring the subject.
  const statusLineByMethod: Record<PaymentMethodKey, string> = {
    zelle: `$${order.total.toFixed(2)} — awaiting Zelle from ${escapeHtml(order.customerName)}.`,
    card: `$${order.total.toFixed(2)} — card payment processing from ${escapeHtml(order.customerName)}. Watch for the Squadco webhook to flip this to paid.`,
    crypto: `$${order.total.toFixed(2)} — awaiting on-chain crypto confirmation from ${escapeHtml(order.customerName)}.`,
    paypal: `$${order.total.toFixed(2)} — PayPal payment processing from ${escapeHtml(order.customerName)}. The return callback will flip this to paid.`,
  }
  const statusLineText: Record<PaymentMethodKey, string> = {
    zelle: `$${order.total.toFixed(2)} — awaiting Zelle from ${order.customerName}.`,
    card: `$${order.total.toFixed(2)} — card payment processing from ${order.customerName}.`,
    crypto: `$${order.total.toFixed(2)} — awaiting on-chain crypto confirmation from ${order.customerName}.`,
    paypal: `$${order.total.toFixed(2)} — PayPal payment processing from ${order.customerName}.`,
  }

  const itemsHtml = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid ${borderColor};">${escapeHtml(i.name)} — ${escapeHtml(i.variant)} × ${i.quantity}</td>
          <td align="right" style="padding:8px 0;border-bottom:1px solid ${borderColor};">$${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`,
    )
    .join("")

  const itemsText = order.items
    .map((i) => `  • ${i.name} — ${i.variant} × ${i.quantity}  $${(i.price * i.quantity).toFixed(2)}`)
    .join("\n")

  const html = shell(`
    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;">New order</p>
    <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:24px;font-weight:500;">${order.orderNumber}</h1>
    <p style="margin:0 0 20px 0;font-size:15px;">${statusLineByMethod[method]}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:16px;">
      ${itemsHtml}
      <tr><td style="padding:12px 0 0 0;font-weight:600;">Total</td><td align="right" style="padding:12px 0 0 0;font-weight:600;">$${order.total.toFixed(2)}</td></tr>
    </table>

    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};">Payment method</p>
    <p style="margin:0 0 20px 0;font-size:14px;text-transform:capitalize;">${escapeHtml(methodLabel)}</p>

    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};">Customer</p>
    <p style="margin:0 0 20px 0;font-size:14px;">${escapeHtml(order.customerName)}<br><a href="mailto:${escapeHtml(order.customerEmail)}" style="color:${brandColor};text-decoration:none;">${escapeHtml(order.customerEmail)}</a></p>

    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};">Ship to</p>
    <p style="margin:0 0 20px 0;font-size:14px;white-space:pre-line;">${escapeHtml(order.shippingAddress)}</p>
  `)

  const text = `PeptideXM — New order ${order.orderNumber}

${statusLineText[method]}

Items:
${itemsText}
  Total: $${order.total.toFixed(2)}

Payment method: ${methodLabel}

Customer: ${order.customerName} <${order.customerEmail}>

Ship to:
${order.shippingAddress}`

  return sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
    text,
    replyTo: order.customerEmail,
  })
}

export async function sendPaymentSubmittedAdminEmail(args: {
  orderNumber: string
  customerName: string
  customerEmail: string
  reference: string
  total: number
}) {
  const subject = `Payment submitted for ${args.orderNumber} — verify Zelle`
  const html = shell(`
    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;">Zelle reference received</p>
    <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:24px;font-weight:500;">${args.orderNumber}</h1>
    <p style="margin:0 0 20px 0;font-size:15px;">${escapeHtml(args.customerName)} submitted a Zelle reference for their $${args.total.toFixed(2)} order.</p>

    <div style="background:#f3f4f6;border:1px solid ${borderColor};border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:12px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Zelle reference</div>
      <div style="font-family:monospace;font-size:16px;word-break:break-all;">${escapeHtml(args.reference)}</div>
    </div>

    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};">Customer</p>
    <p style="margin:0;font-size:14px;">${escapeHtml(args.customerName)}<br><a href="mailto:${escapeHtml(args.customerEmail)}" style="color:${brandColor};text-decoration:none;">${escapeHtml(args.customerEmail)}</a></p>
  `)
  const text = `PeptideXM — Payment submitted for ${args.orderNumber}

${args.customerName} submitted a Zelle reference for their $${args.total.toFixed(2)} order.

Zelle reference: ${args.reference}

Customer: ${args.customerName} <${args.customerEmail}>`

  return sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
    text,
    replyTo: args.customerEmail,
  })
}

// ---------- Order status update ----------

export type OrderStatusKind = "status" | "payment" | "shipped" | "cancelled"

export async function sendOrderStatusUpdateEmail(input: {
  kind: OrderStatusKind
  orderNumber: string
  customerName: string
  customerEmail: string
  status?: string | null
  paymentStatus?: string | null
  trackingCarrier?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
  note?: string | null
}) {
  let subject = `PeptideXM — Order ${input.orderNumber} update`
  let heroLabel = "Order update"
  let heading = `Update on order ${input.orderNumber}`
  let lead = ""

  if (input.kind === "shipped" && input.trackingNumber) {
    subject = `Your PeptideXM order ${input.orderNumber} has shipped`
    heroLabel = "Shipped"
    heading = "Your order is on its way"
    lead = `We just handed your package off to ${escapeHtml(input.trackingCarrier || "the carrier")}.`
  } else if (input.kind === "payment" && input.paymentStatus) {
    subject = `PeptideXM — Payment ${input.paymentStatus} for order ${input.orderNumber}`
    heroLabel = "Payment"
    heading = input.paymentStatus === "paid" ? "Payment confirmed" : `Payment ${input.paymentStatus}`
    lead =
      input.paymentStatus === "paid"
        ? "We've verified your Zelle transfer. Your order is being prepared for shipment."
        : `Your payment status changed to ${escapeHtml(input.paymentStatus)}.`
  } else if (input.kind === "cancelled") {
    subject = `PeptideXM — Order ${input.orderNumber} cancelled`
    heroLabel = "Cancelled"
    heading = "Your order was cancelled"
    lead = input.note || "If this was a mistake, just reply to this email and we'll sort it out."
  } else if (input.kind === "status" && input.status) {
    heroLabel = "Order update"
    heading = `Order status: ${input.status}`
    lead = `Your order is now marked as ${escapeHtml(input.status)}.`
  }

  const trackingHtml =
    input.trackingNumber && input.trackingCarrier
      ? `
    <div style="background:#fdf6ee;border:1px solid #ecd8c0;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <div style="font-size:12px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Tracking</div>
      <div style="font-size:15px;margin-bottom:4px;"><strong>Carrier:</strong> ${escapeHtml(input.trackingCarrier)}</div>
      <div style="font-size:15px;"><strong>Number:</strong> <span style="font-family:monospace;">${escapeHtml(input.trackingNumber)}</span></div>
      ${input.trackingUrl ? `<div style="margin-top:12px;"><a href="${escapeHtml(input.trackingUrl)}" style="color:${brandColor};text-decoration:none;font-weight:500;">Track package →</a></div>` : ""}
    </div>`
      : ""

  const noteHtml =
    input.note && input.kind !== "cancelled"
      ? `<div style="background:#f3f4f6;border:1px solid ${borderColor};border-radius:10px;padding:16px 20px;margin:0 0 20px;">
          <div style="font-size:12px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Note from us</div>
          <div style="font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(input.note)}</div>
        </div>`
      : ""

  const html = shell(`
    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(heroLabel)}</p>
    <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:24px;font-weight:500;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;">${lead}</p>

    <div style="font-size:14px;color:${mutedText};margin-bottom:4px;">Order</div>
    <div style="font-family:monospace;font-size:15px;margin-bottom:20px;">${escapeHtml(input.orderNumber)}</div>

    ${trackingHtml}
    ${noteHtml}

    <p style="margin:0;font-size:13px;color:${mutedText};">Questions? Just reply to this email.</p>
  `)

  const lines = [
    `PeptideXM — ${heading}`,
    "",
    lead,
    "",
    `Order: ${input.orderNumber}`,
  ]
  if (input.trackingNumber) {
    lines.push(`Tracking: ${input.trackingCarrier || ""} ${input.trackingNumber}`.trim())
    if (input.trackingUrl) lines.push(`Track: ${input.trackingUrl}`)
  }
  if (input.note && input.kind !== "cancelled") lines.push("", `Note: ${input.note}`)
  const text = lines.join("\n")

  return sendEmail({
    to: input.customerEmail,
    subject,
    html,
    text,
    replyTo: CONTACT_EMAIL,
  })
}

// ---------- Abandoned cart recovery ----------

export type AbandonedCartReminderInput = {
  /** Shopper's first name, if we captured it at checkout; used to personalize. */
  firstName?: string | null
  customerEmail: string
  /** Which reminder this is (1 = nudge, 2 = final). Drives subject + copy tone. */
  ordinal: 1 | 2
  /** Running cart subtotal (USD). Rendered pre-shipping so it matches checkout. */
  subtotal: number
  items: Array<{ name: string; variant: string; quantity: number; price: number; image?: string | null }>
  /** Absolute URL that restores the cart and drops them on /checkout. */
  recoveryUrl: string
}

export async function sendAbandonedCartReminderEmail(input: AbandonedCartReminderInput) {
  const first = input.firstName?.trim()
  const greeting = first ? `Hi ${escapeHtml(first)},` : "Hi there,"

  const subject =
    input.ordinal === 1
      ? "You left items in your cart at PeptideXM"
      : "Last chance — your PeptideXM cart is about to expire"

  const lead =
    input.ordinal === 1
      ? "We saved your cart so you can pick up right where you left off. Your items are still available today — click below to finish checkout in one tap."
      : "This is the final reminder for the cart you started. We'll release the reserved stock soon — if you still want these items, grab them now."

  const itemsHtml = input.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid ${borderColor};">
            <div style="font-weight:500;">${escapeHtml(i.name)}</div>
            <div style="font-size:13px;color:${mutedText};">${escapeHtml(i.variant)} × ${i.quantity}</div>
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid ${borderColor};white-space:nowrap;">$${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`,
    )
    .join("")

  const itemsText = input.items
    .map((i) => `  • ${i.name} — ${i.variant} × ${i.quantity}  $${(i.price * i.quantity).toFixed(2)}`)
    .join("\n")

  const html = shell(`
    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};text-transform:uppercase;letter-spacing:0.08em;">Cart reminder</p>
    <h1 style="margin:0 0 16px 0;font-family:Georgia,serif;font-size:26px;font-weight:500;">${greeting}</h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;">${lead}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:16px;">
      ${itemsHtml}
      <tr><td style="padding:14px 0 0 0;font-weight:600;">Subtotal</td><td align="right" style="padding:14px 0 0 0;font-weight:600;">$${input.subtotal.toFixed(2)}</td></tr>
    </table>

    <div style="text-align:center;margin:28px 0 24px;">
      <a href="${escapeHtml(input.recoveryUrl)}" style="display:inline-block;background:${brandColor};color:#ffffff;font-weight:600;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;">Complete my order →</a>
    </div>

    <p style="margin:0;font-size:13px;color:${mutedText};line-height:1.6;">Questions or need something swapped? Just reply to this email — a human will read it.</p>
  `)

  const text = `PeptideXM — ${input.ordinal === 1 ? "You left items in your cart" : "Last chance for your cart"}

${first ? `Hi ${first},` : "Hi there,"}

${lead}

${itemsText}
  Subtotal: $${input.subtotal.toFixed(2)}

Complete your order: ${input.recoveryUrl}

Questions? Just reply to this email.`

  return sendEmail({
    to: input.customerEmail,
    subject,
    html,
    text,
    from: BROADCAST_FROM_EMAIL,
    replyTo: CONTACT_EMAIL,
  })
}

// ---------- Marketing broadcast ----------

export async function sendBroadcastEmail(input: {
  to: string
  subject: string
  preview?: string | null
  bodyHtml: string
  textFallback: string
}) {
  const preHeader = input.preview
    ? `<div style="display:none;overflow:hidden;color:transparent;height:0;width:0;opacity:0;">${escapeHtml(input.preview)}</div>`
    : ""

  const html = shell(`
    ${preHeader}
    <div style="font-size:15px;line-height:1.7;color:#111827;">${input.bodyHtml}</div>
  `)

  return sendEmail({
    to: input.to,
    subject: input.subject,
    html,
    text: input.textFallback,
    from: BROADCAST_FROM_EMAIL,
    replyTo: CONTACT_EMAIL,
  })
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Notify the admin that a visitor submitted the chat bubble. Two
 * details that justify a dedicated template instead of a generic
 * "contact form" email:
 *
 *   1. The subject line tags whether the lead came in during business
 *      hours or after-hours. After-hours leads need faster reply SLAs
 *      because the visitor was explicitly told "we'll get back to you"
 *      — those should rise to the top of the inbox glance.
 *   2. `replyTo` is set to the visitor's email so the admin can hit
 *      Reply directly from Gmail and the response goes to the right
 *      inbox without copy-paste, despite the From: address being our
 *      transactional sender.
 */
export async function sendChatLeadEmail(input: {
  id: string
  email: string
  name: string | null
  phone: string | null
  message: string
  submittedWhen: "online" | "offline"
  pageUrl: string | null
}) {
  const tag = input.submittedWhen === "offline" ? "after-hours lead" : "new chat"
  const subject = `[${tag}] ${input.name?.trim() || input.email}`

  // Linking to the admin chat detail saves the operator one click; we
  // build the URL from the same env var the rest of the codebase uses.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.peptidexm.com"
  const adminUrl = `${siteUrl}/admin/inbox/chats/${input.id}`

  const rows: Array<[string, string]> = [
    ["From", input.name ? `${input.name} <${input.email}>` : input.email],
  ]
  if (input.phone) rows.push(["Phone", input.phone])
  if (input.pageUrl) rows.push(["Page", input.pageUrl])
  rows.push(["Submitted", input.submittedWhen === "offline" ? "After-hours" : "During business hours"])

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr>
           <td style="padding:6px 12px 6px 0;color:${mutedText};font-size:13px;width:90px;vertical-align:top;">${escapeHtml(label)}</td>
           <td style="padding:6px 0;font-size:14px;color:#111827;">${escapeHtml(value)}</td>
         </tr>`,
    )
    .join("")

  const html = shell(`
    <h1 style="margin:0 0 4px 0;font-family:Georgia,serif;font-size:22px;font-weight:500;color:#111827;">
      ${input.submittedWhen === "offline" ? "After-hours lead" : "New chat message"}
    </h1>
    <p style="margin:0 0 20px 0;color:${mutedText};font-size:13px;">
      ${
        input.submittedWhen === "offline"
          ? "We were closed when this came in. The visitor was promised a reply within 24 hours."
          : "Submitted while the bubble showed us as online."
      }
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px 0;">
      ${tableRows}
    </table>
    <div style="border-top:1px solid ${borderColor};padding-top:16px;font-size:14px;line-height:1.6;color:#111827;white-space:pre-wrap;">${escapeHtml(
      input.message,
    )}</div>
    <p style="margin:24px 0 0 0;">
      <a href="${adminUrl}" style="display:inline-block;background:${brandColor};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;">
        Open in admin inbox
      </a>
    </p>
    <p style="margin:16px 0 0 0;color:${mutedText};font-size:12px;">
      Reply to this email and your response will go straight to ${escapeHtml(input.email)}.
    </p>
  `)

  // Plain-text fallback. Order matters: visitor identification first
  // so a phone-skim of the email still surfaces the right name.
  const textLines = [
    `${input.submittedWhen === "offline" ? "After-hours lead" : "New chat message"}`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "Message:",
    input.message,
    "",
    `Open in admin: ${adminUrl}`,
  ]

  return sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
    text: textLines.join("\n"),
    replyTo: input.email,
  })
}
