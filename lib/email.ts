import "server-only"
import { Resend } from "resend"
import { CONTACT_EMAIL } from "@/lib/contact"

const FROM_EMAIL = process.env.EMAIL_FROM ?? "PeptideXM <noreply@peptidexm.com>"
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
}

export async function sendEmail({ to, subject, html, text, replyTo }: SendArgs) {
  const resend = getResend()
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping email to", to)
    return { skipped: true as const }
  }
  try {
    const res = await resend.emails.send({
      from: FROM_EMAIL,
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
}

export async function sendOrderPlacedCustomerEmail(order: OrderEmailInput) {
  const subject = `Order ${order.orderNumber} received — complete your Zelle payment`

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
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;">Your order <strong>${order.orderNumber}</strong> is confirmed. To finalize it, send payment via <strong>Zelle</strong> using the instructions below.</p>

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

    <h2 style="margin:0 0 12px 0;font-size:16px;">Order summary</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:16px;">
      ${itemsHtml}
      <tr><td style="padding:12px 0 0 0;font-weight:600;">Total</td><td align="right" style="padding:12px 0 0 0;font-weight:600;">$${order.total.toFixed(2)}</td></tr>
    </table>

    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};">Shipping to</p>
    <p style="margin:0 0 24px 0;font-size:14px;white-space:pre-line;">${escapeHtml(order.shippingAddress)}</p>

    <p style="margin:0;font-size:14px;line-height:1.6;color:${mutedText};">After sending payment, reply to this email with your Zelle confirmation number or submit it on your account page.</p>
  `)

  const text = `PeptideXM — Order ${order.orderNumber} received

Thanks, ${order.customerName}. Your order is confirmed.

To finalize it, send payment via Zelle:
  Send to: ${CONTACT_EMAIL}
  Amount: $${order.total.toFixed(2)}
  Memo / Note: ${order.orderNumber}

IMPORTANT: Use ONLY your order number (${order.orderNumber}) in the Zelle memo. Do NOT mention product names or any research terms — orders that include them will be cancelled automatically and the payment refunded.

Order summary:
${itemsText}
  Total: $${order.total.toFixed(2)}

Shipping to:
${order.shippingAddress}

After sending payment, reply to this email with your Zelle confirmation number.

Questions? ${CONTACT_EMAIL}`

  return sendEmail({
    to: order.customerEmail,
    subject,
    html,
    text,
    replyTo: CONTACT_EMAIL,
  })
}

export async function sendOrderPlacedAdminEmail(order: OrderEmailInput) {
  const subject = `New order ${order.orderNumber} — $${order.total.toFixed(2)} (pending Zelle)`

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
    <p style="margin:0 0 20px 0;font-size:15px;">$${order.total.toFixed(2)} — awaiting Zelle from ${escapeHtml(order.customerName)}.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:16px;">
      ${itemsHtml}
      <tr><td style="padding:12px 0 0 0;font-weight:600;">Total</td><td align="right" style="padding:12px 0 0 0;font-weight:600;">$${order.total.toFixed(2)}</td></tr>
    </table>

    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};">Customer</p>
    <p style="margin:0 0 20px 0;font-size:14px;">${escapeHtml(order.customerName)}<br><a href="mailto:${escapeHtml(order.customerEmail)}" style="color:${brandColor};text-decoration:none;">${escapeHtml(order.customerEmail)}</a></p>

    <p style="margin:0 0 8px 0;font-size:14px;color:${mutedText};">Ship to</p>
    <p style="margin:0 0 20px 0;font-size:14px;white-space:pre-line;">${escapeHtml(order.shippingAddress)}</p>
  `)

  const text = `PeptideXM — New order ${order.orderNumber}

$${order.total.toFixed(2)} — awaiting Zelle from ${order.customerName}.

Items:
${itemsText}
  Total: $${order.total.toFixed(2)}

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
