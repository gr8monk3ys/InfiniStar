/**
 * Email Sending Utilities
 *
 * The five account-management notifications, and the one seam they all go
 * through. Which provider carries them lives in `email-delivery.ts`;
 * verification, password reset and 2FA are Clerk's.
 */

import { config } from "@/app/lib/config"
import { deliver } from "@/app/lib/email-delivery"
import logger from "@/app/lib/logger"

import {
  getAccountDeletedEmailTemplate,
  getAccountDeletionCancelledEmailTemplate,
  getAccountDeletionPendingEmailTemplate,
  getPaymentFailedEmailTemplate,
  getWelcomeEmailTemplate,
} from "./email-templates"

/**
 * Email configuration from environment
 */
function getEmailConfig() {
  return {
    fromAddress: config.fromEmail,
    appUrl: config.appUrl,
    isDevelopment: process.env.NODE_ENV === "development",
  }
}

/**
 * The one place a notification leaves the app.
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
  const emailConfig = getEmailConfig()

  // In development, log email details
  if (emailConfig.isDevelopment) {
    logger.info({ to, subject, textBody }, "Development email (not sent)")
    return true
  }

  return deliver({
    to,
    from: emailConfig.fromAddress,
    subject,
    htmlBody,
    textBody,
  })
}

/**
 * Send welcome email (after verification)
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const emailConfig = getEmailConfig()
  const dashboardUrl = `${emailConfig.appUrl}/dashboard/conversations`
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
  const emailConfig = getEmailConfig()
  const formattedDate = deletionDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const cancelUrl = `${emailConfig.appUrl}/dashboard/profile`
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
  const emailConfig = getEmailConfig()
  const dashboardUrl = `${emailConfig.appUrl}/dashboard/conversations`
  const template = getAccountDeletionCancelledEmailTemplate({ name, dashboardUrl })

  return sendEmail({
    to: email,
    subject: template.subject,
    htmlBody: template.html,
    textBody: template.text,
  })
}

/**
 * Send payment failed notification email
 */
export async function sendPaymentFailedEmail(email: string, name: string): Promise<boolean> {
  const emailConfig = getEmailConfig()
  const billingUrl = `${emailConfig.appUrl}/api/stripe/portal`
  const template = getPaymentFailedEmailTemplate({ name, billingUrl })

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
