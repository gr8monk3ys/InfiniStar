/**
 * Where an outbound email actually goes.
 *
 * `email.ts` owns *what* is sent — five templates, five call sites, one
 * `sendEmail` seam. This owns *how*, because that turned out to be the part
 * that was broken: production held a `POSTMARK_API_TOKEN` that Postmark
 * rejects ("Request does not contain a valid Server token") and an `SMTP_FROM`
 * of `@example.com`. Every one of the five has been silently returning `false`
 * since the day it was written — the welcome mail, the payment-failure notice,
 * and three account-deletion notices that are a GDPR commitment.
 *
 * Resend is the default because its DNS is already verified on
 * `send.lscaturchio.xyz` — SES MX, `resend._domainkey`, and an SPF include —
 * so it is the provider that can actually deliver today. Postmark stays behind
 * the same interface rather than being deleted: it costs twenty lines, and a
 * transactional sender is exactly the thing you want a second adapter for when
 * the first one starts bouncing.
 *
 * Both return `false` rather than throwing. A failed notification must not take
 * down the account deletion or the webhook that triggered it — the caller logs
 * and carries on, which is the behaviour `email.ts` already relied on.
 */

import logger from "@/app/lib/logger"

export interface OutboundEmail {
  to: string
  from: string
  subject: string
  htmlBody: string
  textBody: string
}

const RESEND_API_URL = "https://api.resend.com/emails"
const POSTMARK_API_URL = "https://api.postmarkapp.com/email"

async function deliverWithResend(message: OutboundEmail, apiKey: string): Promise<boolean> {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      html: message.htmlBody,
      text: message.textBody,
    }),
  })

  if (!response.ok) {
    // Resend puts the useful part in the body: an unverified `from` domain and
    // a bad key both come back as 4xx with different messages, and telling them
    // apart from the status alone is impossible.
    const detail = await response.text().catch(() => "")
    logger.error(
      { provider: "resend", status: response.status, detail: detail.slice(0, 500) },
      "Email provider rejected the message"
    )
    return false
  }

  return true
}

async function deliverWithPostmark(message: OutboundEmail, apiToken: string): Promise<boolean> {
  const response = await fetch(POSTMARK_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": apiToken,
    },
    body: JSON.stringify({
      From: message.from,
      To: message.to,
      Subject: message.subject,
      HtmlBody: message.htmlBody,
      TextBody: message.textBody,
      MessageStream: "outbound",
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    logger.error(
      { provider: "postmark", status: response.status, detail: detail.slice(0, 500) },
      "Email provider rejected the message"
    )
    return false
  }

  return true
}

/**
 * Hands the message to whichever provider is configured.
 *
 * Resend wins when both are, because it is the one with verified DNS. Returns
 * `false` when neither is configured, having said so at `error` level — a
 * missing sender is not a quiet condition when three of the five messages are
 * a legal commitment.
 */
export async function deliver(message: OutboundEmail): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  const postmarkToken = process.env.POSTMARK_API_TOKEN

  try {
    if (resendKey) {
      return await deliverWithResend(message, resendKey)
    }
    if (postmarkToken) {
      return await deliverWithPostmark(message, postmarkToken)
    }
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      "Failed to reach the email provider"
    )
    return false
  }

  logger.error("No email provider is configured. Set RESEND_API_KEY (or POSTMARK_API_TOKEN).")
  return false
}
