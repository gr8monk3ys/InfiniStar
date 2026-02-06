/**
 * Two-Factor Authentication (2FA) Utilities
 *
 * Provides TOTP generation, verification, and encryption for 2FA secrets.
 * Uses AES-256-GCM for encrypting secrets at rest.
 */

import crypto from "crypto"
import { generateSecret, generateURI, verifySync } from "otplib"

const TOTP_PERIOD_SECONDS = 30
const TOTP_TOLERANCE_SECONDS = 30

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32

/**
 * Derive encryption key from NEXTAUTH_SECRET
 * Uses PBKDF2 with SHA-256 for key derivation
 */
function deriveKey(salt: Buffer): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured")
  }

  return crypto.pbkdf2Sync(secret, salt, 100000, 32, "sha256")
}

/**
 * Encrypt a TOTP secret for secure storage
 * Format: salt:iv:authTag:encryptedData (all base64 encoded)
 */
export function encryptSecret(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKey(salt)
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, "utf8", "base64")
  encrypted += cipher.final("base64")

  const authTag = cipher.getAuthTag()

  // Combine all components
  return [
    salt.toString("base64"),
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted,
  ].join(":")
}

/**
 * Decrypt a TOTP secret from storage
 */
export function decryptSecret(encryptedData: string): string {
  const parts = encryptedData.split(":")
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted data format")
  }

  const [saltB64, ivB64, authTagB64, encrypted] = parts
  const salt = Buffer.from(saltB64, "base64")
  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")
  const key = deriveKey(salt)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, "base64", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Generate a new TOTP secret
 */
export function generateTOTPSecret(): string {
  return generateSecret()
}

/**
 * Generate TOTP authentication URL for QR code
 */
export function generateTOTPAuthURL(
  secret: string,
  email: string,
  issuer: string = "InfiniStar"
): string {
  return generateURI({
    issuer,
    label: email,
    secret,
    strategy: "totp",
    period: TOTP_PERIOD_SECONDS,
  })
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTPCode(token: string, secret: string): boolean {
  try {
    return verifySync({
      token,
      secret,
      strategy: "totp",
      period: TOTP_PERIOD_SECONDS,
      epochTolerance: TOTP_TOLERANCE_SECONDS,
    }).valid
  } catch {
    return false
  }
}

/**
 * Generate backup codes for account recovery
 * Returns both plain codes (to show user once) and hashed codes (for storage)
 */
export function generateBackupCodes(count: number = 10): {
  plainCodes: string[]
  hashedCodes: string[]
} {
  const plainCodes: string[] = []
  const hashedCodes: string[] = []

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString("hex").toUpperCase()
    plainCodes.push(code)
    // Hash the code for secure storage
    hashedCodes.push(hashBackupCode(code))
  }

  return { plainCodes, hashedCodes }
}

/**
 * Hash a backup code for secure storage
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(code.toUpperCase()).digest("hex")
}

/**
 * Verify a backup code against stored hashed codes
 * Returns the index of the used code if valid, -1 if invalid
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): number {
  const hashedInput = hashBackupCode(code)
  return hashedCodes.findIndex((hashed) => hashed === hashedInput)
}

/**
 * Format backup codes for display (add dashes for readability)
 */
export function formatBackupCode(code: string): string {
  // Format as XXXX-XXXX
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/**
 * Parse formatted backup code (remove dashes)
 */
export function parseBackupCode(formattedCode: string): string {
  return formattedCode.replace(/-/g, "").toUpperCase()
}
