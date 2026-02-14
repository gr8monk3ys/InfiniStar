/**
 * Email Templates
 *
 * HTML and text templates for all transactional emails.
 * Separated from the email sending logic for better maintainability.
 */

/**
 * Common email styles used across all templates
 */
const STYLES = {
  body: `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;`,
  header: `text-align: center; margin-bottom: 30px;`,
  logo: `color: #6366f1; margin: 0;`,
  h2Default: `color: #1f2937;`,
  h2Success: `color: #16a34a;`,
  h2Danger: `color: #dc2626;`,
  h3: `color: #374151;`,
  button: `background-color: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;`,
  buttonContainer: `text-align: center; margin: 30px 0;`,
  link: `word-break: break-all; color: #6366f1; font-size: 14px;`,
  muted: `color: #6b7280; font-size: 14px;`,
  veryMuted: `color: #9ca3af; font-size: 12px;`,
  hr: `border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;`,
  list: `color: #4b5563;`,
  alertSuccess: `background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 15px; margin: 20px 0;`,
  alertSuccessText: `margin: 0; color: #166534; font-weight: 500;`,
  alertDanger: `background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 15px; margin: 20px 0;`,
  alertDangerText: `margin: 0; color: #991b1b; font-weight: 500;`,
  highlight: `font-size: 18px; font-weight: bold; color: #dc2626; text-align: center; padding: 15px; background-color: #fef2f2; border-radius: 6px;`,
} as const

/**
 * Get current year for copyright
 */
function getCurrentYear(): number {
  return new Date().getFullYear()
}

/**
 * Base HTML wrapper for all emails
 */
function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="${STYLES.body}">
  <div style="${STYLES.header}">
    <h1 style="${STYLES.logo}">InfiniStar</h1>
  </div>

${content}

  <hr style="${STYLES.hr}">

  <p style="${STYLES.veryMuted}">
    &copy; ${getCurrentYear()} InfiniStar. All rights reserved.
  </p>
</body>
</html>`
}

/**
 * Create a call-to-action button HTML
 */
function createButton(text: string, url: string): string {
  return `<div style="${STYLES.buttonContainer}">
    <a href="${url}" style="${STYLES.button}">
      ${text}
    </a>
  </div>`
}

// =============================================================================
// Email Templates
// =============================================================================

export interface VerificationEmailParams {
  name: string
  verificationUrl: string
}

export function getVerificationEmailTemplate(params: VerificationEmailParams) {
  const { name, verificationUrl } = params

  const html = wrapHtml(`
  <h2 style="${STYLES.h2Default}">Welcome to InfiniStar!</h2>

  <p>Hi ${name},</p>

  <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>

  ${createButton("Verify Email Address", verificationUrl)}

  <p style="${STYLES.muted}">Or copy and paste this link into your browser:</p>
  <p style="${STYLES.link}">${verificationUrl}</p>

  <p style="${STYLES.muted}">This link will expire in 24 hours.</p>

  <p style="${STYLES.veryMuted}">
    If you didn't create an account with InfiniStar, you can safely ignore this email.
  </p>`)

  const text = `Welcome to InfiniStar!

Hi ${name},

Thanks for signing up! Please verify your email address by visiting the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with InfiniStar, you can safely ignore this email.

© ${getCurrentYear()} InfiniStar. All rights reserved.`

  return {
    subject: "Verify your email address - InfiniStar",
    html,
    text,
  }
}

export interface PasswordResetEmailParams {
  name: string
  resetUrl: string
}

export function getPasswordResetEmailTemplate(params: PasswordResetEmailParams) {
  const { name, resetUrl } = params

  const html = wrapHtml(`
  <h2 style="${STYLES.h2Default}">Reset Your Password</h2>

  <p>Hi ${name},</p>

  <p>We received a request to reset your password. Click the button below to create a new password:</p>

  ${createButton("Reset Password", resetUrl)}

  <p style="${STYLES.muted}">Or copy and paste this link into your browser:</p>
  <p style="${STYLES.link}">${resetUrl}</p>

  <p style="${STYLES.muted}">This link will expire in 24 hours.</p>

  <p style="${STYLES.veryMuted}">
    If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
  </p>`)

  const text = `Reset Your Password

Hi ${name},

We received a request to reset your password. Visit the link below to create a new password:

${resetUrl}

This link will expire in 24 hours.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

© ${getCurrentYear()} InfiniStar. All rights reserved.`

  return {
    subject: "Reset your password - InfiniStar",
    html,
    text,
  }
}

export interface WelcomeEmailParams {
  name: string
  dashboardUrl: string
}

export function getWelcomeEmailTemplate(params: WelcomeEmailParams) {
  const { name, dashboardUrl } = params

  const html = wrapHtml(`
  <h2 style="${STYLES.h2Default}">Welcome to InfiniStar! 🎉</h2>

  <p>Hi ${name},</p>

  <p>Your email has been verified and your account is now active. You're ready to start chatting with AI!</p>

  <h3 style="${STYLES.h3}">Here's what you can do:</h3>

  <ul style="${STYLES.list}">
    <li><strong>Chat with 7 AI personalities</strong> - Helpful, Creative, Analytical, and more</li>
    <li><strong>Choose your AI model</strong> - Claude Sonnet 4.5 or Haiku 4.5</li>
    <li><strong>Organize conversations</strong> - Pin, archive, and tag your chats</li>
    <li><strong>AI memory</strong> - Let the AI remember important details</li>
    <li><strong>Export & share</strong> - Download or share your conversations</li>
  </ul>

  ${createButton("Start Chatting", dashboardUrl)}

  <p style="${STYLES.muted}">
    You have <strong>50 free messages</strong> per month. Upgrade to PRO for higher limits!
  </p>`)

  const text = `Welcome to InfiniStar! 🎉

Hi ${name},

Your email has been verified and your account is now active. You're ready to start chatting with AI!

Here's what you can do:
- Chat with 7 AI personalities - Helpful, Creative, Analytical, and more
- Choose your AI model - Claude Sonnet 4.5 or Haiku 4.5
- Organize conversations - Pin, archive, and tag your chats
- AI memory - Let the AI remember important details
- Export & share - Download or share your conversations

Start chatting: ${dashboardUrl}

You have 50 free messages per month. Upgrade to PRO for higher limits!

© ${getCurrentYear()} InfiniStar. All rights reserved.`

  return {
    subject: "Welcome to InfiniStar! 🎉",
    html,
    text,
  }
}

export interface AccountDeletionPendingEmailParams {
  name: string
  deletionDate: string
  cancelUrl: string
}

export function getAccountDeletionPendingEmailTemplate(params: AccountDeletionPendingEmailParams) {
  const { name, deletionDate, cancelUrl } = params

  const html = wrapHtml(`
  <h2 style="${STYLES.h2Danger}">Account Deletion Scheduled</h2>

  <p>Hi ${name},</p>

  <p>We've received your request to delete your InfiniStar account. Your account and all associated data will be permanently deleted on:</p>

  <p style="${STYLES.highlight}">
    ${deletionDate}
  </p>

  <h3 style="${STYLES.h3}">What will be deleted:</h3>
  <ul style="${STYLES.list}">
    <li>Your account and profile information</li>
    <li>All conversations and messages</li>
    <li>AI memories and preferences</li>
    <li>Subscription data (if applicable)</li>
  </ul>

  <p>Changed your mind? You can cancel the deletion request anytime before the scheduled date.</p>

  ${createButton("Cancel Deletion Request", cancelUrl)}

  <p style="${STYLES.veryMuted}">
    If you didn't request account deletion, please cancel the request immediately and secure your account.
  </p>`)

  const text = `Account Deletion Scheduled

Hi ${name},

We've received your request to delete your InfiniStar account. Your account and all associated data will be permanently deleted on:

${deletionDate}

What will be deleted:
- Your account and profile information
- All conversations and messages
- AI memories and preferences
- Subscription data (if applicable)

Changed your mind? You can cancel the deletion request anytime before the scheduled date:
${cancelUrl}

If you didn't request account deletion, please cancel the request immediately and secure your account.

© ${getCurrentYear()} InfiniStar. All rights reserved.`

  return {
    subject: "Account Deletion Scheduled - InfiniStar",
    html,
    text,
  }
}

export interface AccountDeletionCancelledEmailParams {
  name: string
  dashboardUrl: string
}

export function getAccountDeletionCancelledEmailTemplate(
  params: AccountDeletionCancelledEmailParams
) {
  const { name, dashboardUrl } = params

  const html = wrapHtml(`
  <h2 style="${STYLES.h2Success}">Account Deletion Cancelled ✓</h2>

  <p>Hi ${name},</p>

  <p>Good news! Your account deletion request has been cancelled. Your InfiniStar account is safe and all your data remains intact.</p>

  <p>You can continue using InfiniStar as normal. All your conversations, AI memories, and preferences are still available.</p>

  ${createButton("Continue Chatting", dashboardUrl)}

  <p style="${STYLES.veryMuted}">
    If you didn't cancel this request, please secure your account immediately by changing your password.
  </p>`)

  const text = `Account Deletion Cancelled ✓

Hi ${name},

Good news! Your account deletion request has been cancelled. Your InfiniStar account is safe and all your data remains intact.

You can continue using InfiniStar as normal. All your conversations, AI memories, and preferences are still available.

Continue chatting: ${dashboardUrl}

If you didn't cancel this request, please secure your account immediately by changing your password.

© ${getCurrentYear()} InfiniStar. All rights reserved.`

  return {
    subject: "Account Deletion Cancelled - InfiniStar",
    html,
    text,
  }
}

export interface AccountDeletedEmailParams {
  name: string
}

export function getAccountDeletedEmailTemplate(params: AccountDeletedEmailParams) {
  const { name } = params

  const html = wrapHtml(`
  <h2 style="${STYLES.h2Default}">Account Deleted</h2>

  <p>Hi ${name},</p>

  <p>Your InfiniStar account has been permanently deleted as requested. All associated data has been removed from our systems.</p>

  <h3 style="${STYLES.h3}">What was deleted:</h3>
  <ul style="${STYLES.list}">
    <li>Your account and profile information</li>
    <li>All conversations and messages</li>
    <li>AI memories and preferences</li>
    <li>Subscription data</li>
  </ul>

  <p>We're sorry to see you go. If you ever want to return, you're always welcome to create a new account.</p>

  <p style="${STYLES.muted}">Thank you for being part of InfiniStar.</p>`)

  const text = `Account Deleted

Hi ${name},

Your InfiniStar account has been permanently deleted as requested. All associated data has been removed from our systems.

What was deleted:
- Your account and profile information
- All conversations and messages
- AI memories and preferences
- Subscription data

We're sorry to see you go. If you ever want to return, you're always welcome to create a new account.

Thank you for being part of InfiniStar.

© ${getCurrentYear()} InfiniStar. All rights reserved.`

  return {
    subject: "Your InfiniStar account has been deleted",
    html,
    text,
  }
}

export interface TwoFactorEnabledEmailParams {
  name: string
  profileUrl: string
}

export function get2FAEnabledEmailTemplate(params: TwoFactorEnabledEmailParams) {
  const { name, profileUrl } = params

  const html = wrapHtml(`
  <h2 style="${STYLES.h2Success}">Two-Factor Authentication Enabled 🔒</h2>

  <p>Hi ${name},</p>

  <p>Two-factor authentication (2FA) has been successfully enabled on your InfiniStar account. Your account is now more secure!</p>

  <div style="${STYLES.alertSuccess}">
    <p style="${STYLES.alertSuccessText}">
      ✓ 2FA is now active on your account
    </p>
  </div>

  <p><strong>Important:</strong> Make sure you've saved your backup codes in a safe place. You'll need them if you ever lose access to your authenticator app.</p>

  ${createButton("Manage Security Settings", profileUrl)}

  <p style="${STYLES.veryMuted}">
    If you didn't enable 2FA, please disable it immediately and change your password.
  </p>`)

  const text = `Two-Factor Authentication Enabled 🔒

Hi ${name},

Two-factor authentication (2FA) has been successfully enabled on your InfiniStar account. Your account is now more secure!

✓ 2FA is now active on your account

Important: Make sure you've saved your backup codes in a safe place. You'll need them if you ever lose access to your authenticator app.

Manage security settings: ${profileUrl}

If you didn't enable 2FA, please disable it immediately and change your password.

© ${getCurrentYear()} InfiniStar. All rights reserved.`

  return {
    subject: "Two-Factor Authentication Enabled - InfiniStar",
    html,
    text,
  }
}

export interface TwoFactorDisabledEmailParams {
  name: string
  profileUrl: string
}

export function get2FADisabledEmailTemplate(params: TwoFactorDisabledEmailParams) {
  const { name, profileUrl } = params

  const html = wrapHtml(`
  <h2 style="${STYLES.h2Danger}">Two-Factor Authentication Disabled</h2>

  <p>Hi ${name},</p>

  <p>Two-factor authentication (2FA) has been disabled on your InfiniStar account.</p>

  <div style="${STYLES.alertDanger}">
    <p style="${STYLES.alertDangerText}">
      ⚠ Your account is now less secure
    </p>
  </div>

  <p>We recommend keeping 2FA enabled to protect your account from unauthorized access.</p>

  ${createButton("Re-enable 2FA", profileUrl)}

  <p style="${STYLES.veryMuted}">
    If you didn't disable 2FA, please change your password immediately and re-enable 2FA.
  </p>`)

  const text = `Two-Factor Authentication Disabled

Hi ${name},

Two-factor authentication (2FA) has been disabled on your InfiniStar account.

⚠ Your account is now less secure

We recommend keeping 2FA enabled to protect your account from unauthorized access.

Re-enable 2FA: ${profileUrl}

If you didn't disable 2FA, please change your password immediately and re-enable 2FA.

© ${getCurrentYear()} InfiniStar. All rights reserved.`

  return {
    subject: "Two-Factor Authentication Disabled - InfiniStar",
    html,
    text,
  }
}
