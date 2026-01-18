/**
 * Email Sending Utilities
 *
 * Provides email sending functionality for verification and notifications
 */

import { getResetPasswordUrl, getVerificationUrl } from "./email-verification"

/**
 * Send verification email
 *
 * Note: This is a basic implementation that logs to console in development.
 * For production, integrate with a service like:
 * - SendGrid
 * - AWS SES
 * - Postmark (already configured in env)
 * - Resend
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
): Promise<boolean> {
  const verificationUrl = getVerificationUrl(token)

  // In development, just log the URL
  if (process.env.NODE_ENV === "development") {
    console.log("=".repeat(80))
    console.log("📧 VERIFICATION EMAIL")
    console.log("=".repeat(80))
    console.log(`To: ${email}`)
    console.log(`Name: ${name}`)
    console.log(`Verification URL: ${verificationUrl}`)
    console.log("=".repeat(80))
    return true
  }

  // TODO: In production, send actual email via your email service
  // Example with Postmark (if POSTMARK_API_TOKEN is configured):
  /*
  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': process.env.POSTMARK_API_TOKEN!,
      },
      body: JSON.stringify({
        From: process.env.SMTP_FROM,
        To: email,
        Subject: 'Verify your email address',
        HtmlBody: `
          <h1>Welcome to InfiniStar!</h1>
          <p>Hi ${name},</p>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${verificationUrl}">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        `,
        TextBody: `
          Welcome to InfiniStar!

          Hi ${name},

          Please verify your email address by visiting:
          ${verificationUrl}

          This link will expire in 24 hours.

          If you didn't create an account, you can safely ignore this email.
        `,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
  */

  console.warn("Email sending not configured for production. Set up email service.")
  return false
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
): Promise<boolean> {
  const resetUrl = getResetPasswordUrl(token)

  // In development, just log the URL
  if (process.env.NODE_ENV === "development") {
    console.log("=".repeat(80))
    console.log("🔐 PASSWORD RESET EMAIL")
    console.log("=".repeat(80))
    console.log(`To: ${email}`)
    console.log(`Name: ${name}`)
    console.log(`Reset URL: ${resetUrl}`)
    console.log("=".repeat(80))
    return true
  }

  // TODO: In production, send actual email via your email service
  console.warn("Email sending not configured for production. Set up email service.")
  return false
}

/**
 * Send welcome email (after verification)
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  // In development, just log
  if (process.env.NODE_ENV === "development") {
    console.log("=".repeat(80))
    console.log("👋 WELCOME EMAIL")
    console.log("=".repeat(80))
    console.log(`To: ${email}`)
    console.log(`Name: ${name}`)
    console.log("=".repeat(80))
    return true
  }

  // TODO: In production, send actual welcome email
  return false
}
