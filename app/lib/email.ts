/**
 * Email Sending Utilities
 *
 * Provides email sending functionality for account management notifications
 * using Postmark as the email service provider.
 *
 * Note: Verification, password reset, and 2FA emails are now handled by Clerk.
 */

/* eslint-disable no-console -- Development logging for email debugging is intentional */

import {
  getAccountDeletedEmailTemplate,
  getAccountDeletionCancelledEmailTemplate,
  getAccountDeletionPendingEmailTemplate,
  getWelcomeEmailTemplate,
} from "./email-templates"

const POSTMARK_API_URL = "https://api.postmarkapp.com/email"

/**
 * Email configuration from environment
 */
function getEmailConfig() {
  return {
    apiToken: process.env.POSTMARK_API_TOKEN,
    fromAddress: process.env.SMTP_FROM || "noreply@infinistar.app",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    isDevelopment: process.env.NODE_ENV === "development",
  }
}

/**
 * Generic email sending function via Postmark
 */
async function sendEmail({
  to,
  subject,
  htmlBody,
  textBody,
}: {
  to: string
  subject: string
  htmlBody: string
  textBody: string
}): Promise<boolean> {
  const config = getEmailConfig()

  // In development, log to console
  if (config.isDevelopment) {
    console.log("=".repeat(80))
    console.log(`📧 EMAIL: ${subject}`)
    console.log("=".repeat(80))
    console.log(`To: ${to}`)
    console.log(`Subject: ${subject}`)
    console.log("-".repeat(40))
    console.log("Text Body:")
    console.log(textBody)
    console.log("=".repeat(80))
    return true
  }

  // Check for API token
  if (!config.apiToken) {
    console.error("POSTMARK_API_TOKEN is not configured")
    return false
  }

  try {
    const response = await fetch(POSTMARK_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": config.apiToken,
      },
      body: JSON.stringify({
        From: config.fromAddress,
        To: to,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody,
        MessageStream: "outbound",
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("Postmark API error:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Failed to send email:", error)
    return false
  }
}

/**
 * Send welcome email (after verification)
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const config = getEmailConfig()
  const dashboardUrl = `${config.appUrl}/dashboard/conversations`
  const template = getWelcomeEmailTemplate({ name, dashboardUrl })

  return sendEmail({
    to: email,
    subject: template.subject,
    htmlBody: template.html,
    textBody: template.text,
  })
}

/**
 * Send account deletion pending email
 */
export async function sendAccountDeletionPendingEmail(
  email: string,
  name: string,
  deletionDate: Date
): Promise<boolean> {
  const config = getEmailConfig()
  const formattedDate = deletionDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const cancelUrl = `${config.appUrl}/dashboard/profile`
  const template = getAccountDeletionPendingEmailTemplate({
    name,
    deletionDate: formattedDate,
    cancelUrl,
  })

  return sendEmail({
    to: email,
    subject: template.subject,
    htmlBody: template.html,
    textBody: template.text,
  })
}

/**
 * Send account deletion cancelled email
 */
export async function sendAccountDeletionCancelledEmail(
  email: string,
  name: string
): Promise<boolean> {
  const config = getEmailConfig()
  const dashboardUrl = `${config.appUrl}/dashboard/conversations`
  const template = getAccountDeletionCancelledEmailTemplate({ name, dashboardUrl })

  return sendEmail({
    to: email,
    subject: template.subject,
    htmlBody: template.html,
    textBody: template.text,
  })
}

/**
 * Send account deleted confirmation email
 */
export async function sendAccountDeletedEmail(email: string, name: string): Promise<boolean> {
  const template = getAccountDeletedEmailTemplate({ name })

  return sendEmail({
    to: email,
    subject: template.subject,
    htmlBody: template.html,
    textBody: template.text,
  })
}
