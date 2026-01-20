import crypto from "crypto"
import { UAParser } from "ua-parser-js"

/**
 * Session Utilities
 *
 * Handles user agent parsing, IP masking, and session token generation
 * for the session management feature.
 */

export interface DeviceInfo {
  deviceType: string | null
  browser: string | null
  os: string | null
}

/**
 * Parse user agent string to extract device, browser, and OS information
 *
 * @param userAgent - The user agent string from request headers
 * @returns Object containing device type, browser name/version, and OS name/version
 */
export function parseUserAgent(userAgent: string | null): DeviceInfo {
  if (!userAgent) {
    return {
      deviceType: null,
      browser: null,
      os: null,
    }
  }

  const parser = new UAParser(userAgent)
  const result = parser.getResult()

  // Determine device type
  let deviceType: string | null = null
  if (result.device.type) {
    deviceType = result.device.type
  } else {
    // Default to desktop if no device type detected
    deviceType = "desktop"
  }

  // Format browser string
  let browser: string | null = null
  if (result.browser.name) {
    browser = result.browser.name
    if (result.browser.version) {
      // Only include major version for cleaner display
      const majorVersion = result.browser.version.split(".")[0]
      browser = `${browser} ${majorVersion}`
    }
  }

  // Format OS string
  let os: string | null = null
  if (result.os.name) {
    os = result.os.name
    if (result.os.version) {
      // Only include major.minor version for cleaner display
      const versionParts = result.os.version.split(".")
      const shortVersion = versionParts.slice(0, 2).join(".")
      os = `${os} ${shortVersion}`
    }
  }

  return {
    deviceType,
    browser,
    os,
  }
}

/**
 * Mask an IP address for privacy
 *
 * IPv4: Shows first two octets (e.g., 192.168.x.x)
 * IPv6: Shows first two segments (e.g., 2001:db8:x:x:x:x:x:x)
 *
 * @param ipAddress - The full IP address
 * @returns Masked IP address string
 */
export function maskIpAddress(ipAddress: string | null): string {
  if (!ipAddress) {
    return "Unknown"
  }

  // Handle IPv6
  if (ipAddress.includes(":")) {
    const parts = ipAddress.split(":")
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:****:****`
    }
    return "****:****"
  }

  // Handle IPv4
  const parts = ipAddress.split(".")
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`
  }

  return "Unknown"
}

/**
 * Extract IP address from request headers
 *
 * Checks x-forwarded-for, x-real-ip, and falls back to unknown
 *
 * @param headers - Request headers
 * @returns IP address string or null
 */
export function getIpFromHeaders(headers: Headers): string | null {
  // Check x-forwarded-for first (common for proxies/load balancers)
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; the first one is the client
    return forwarded.split(",")[0].trim()
  }

  // Check x-real-ip (used by nginx)
  const realIp = headers.get("x-real-ip")
  if (realIp) {
    return realIp.trim()
  }

  return null
}

/**
 * Generate a unique session token
 *
 * Creates a cryptographically secure 32-byte random token
 *
 * @returns Hex-encoded session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

/**
 * Calculate session expiry date
 *
 * Default: 30 days from now
 *
 * @param days - Number of days until expiry (default: 30)
 * @returns Date object for expiry
 */
export function calculateSessionExpiry(days: number = 30): Date {
  const expiry = new Date()
  expiry.setDate(expiry.getDate() + days)
  return expiry
}

/**
 * Check if a session has expired
 *
 * @param expiresAt - The session expiry date
 * @returns true if session is expired
 */
export function isSessionExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt)
}

/**
 * Format a date for display in relative terms
 *
 * @param date - The date to format
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return "Just now"
  } else if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  } else if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`
  } else if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`
  } else {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }
}

/**
 * Get device icon name based on device type
 *
 * @param deviceType - The device type (desktop, mobile, tablet)
 * @returns Icon name for the device
 */
export function getDeviceIconName(
  deviceType: string | null
): "desktop" | "mobile" | "tablet" | "unknown" {
  switch (deviceType?.toLowerCase()) {
    case "desktop":
      return "desktop"
    case "mobile":
    case "smartphone":
      return "mobile"
    case "tablet":
      return "tablet"
    default:
      return "unknown"
  }
}
