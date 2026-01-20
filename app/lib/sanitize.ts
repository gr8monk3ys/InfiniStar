/**
 * Input Sanitization Utilities
 *
 * Provides functions to sanitize user-generated content to prevent XSS attacks
 * and other security vulnerabilities.
 *
 * Uses server-safe regex-based sanitization that works in all environments.
 */

// HTML entity map for encoding
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
}

// Regex to match HTML entities for decoding
const DECODE_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&#x2F;": "/",
  "&#x60;": "`",
  "&#x3D;": "=",
  "&nbsp;": " ",
}

/**
 * Escape HTML entities in a string
 *
 * @param unsafe - String that may contain HTML entities
 * @returns String with HTML entities escaped
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>');
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(unsafe: string): string {
  if (!unsafe || typeof unsafe !== "string") {
    return ""
  }

  return unsafe.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char)
}

/**
 * Decode HTML entities in a string
 *
 * @param encoded - String with HTML entities
 * @returns Decoded string
 */
function decodeHtmlEntities(encoded: string): string {
  if (!encoded || typeof encoded !== "string") {
    return ""
  }

  return encoded.replace(
    /&(?:amp|lt|gt|quot|#x27|#39|#x2F|#x60|#x3D|nbsp);/gi,
    (entity) => DECODE_ENTITIES[entity.toLowerCase()] || entity
  )
}

/**
 * Strip all HTML tags from a string
 *
 * @param html - String that may contain HTML
 * @returns Plain text with all HTML removed
 */
function stripHtmlTags(html: string): string {
  if (!html || typeof html !== "string") {
    return ""
  }

  // Remove script and style tags with their content first
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")

  // Remove all HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "")

  // Decode HTML entities
  cleaned = decodeHtmlEntities(cleaned)

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim()

  return cleaned
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * Strips all potentially dangerous content
 *
 * @param dirty - Untrusted HTML string
 * @param options - Configuration options
 * @returns Sanitized HTML string safe for rendering
 *
 * @example
 * const userInput = '<script>alert("xss")</script><p>Hello</p>';
 * const clean = sanitizeHtml(userInput);
 * // Result: '<p>Hello</p>'
 */
export function sanitizeHtml(
  dirty: string,
  options?: {
    allowedTags?: string[]
  }
): string {
  if (!dirty || typeof dirty !== "string") {
    return ""
  }

  const allowedTags = options?.allowedTags || [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
  ]

  // Remove script and style tags with content
  let cleaned = dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")

  // Remove event handlers and javascript: URLs
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*(['"])[^'"]*\1/gi, "")
  cleaned = cleaned.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "")
  cleaned = cleaned.replace(/href\s*=\s*(['"])javascript:[^'"]*\1/gi, 'href=""')
  cleaned = cleaned.replace(/src\s*=\s*(['"])javascript:[^'"]*\1/gi, 'src=""')

  // Build regex pattern for allowed tags
  const allowedPattern = allowedTags.join("|")
  const tagRegex = new RegExp(`<(?!\\/?(${allowedPattern})(?:\\s|>|$))[^>]*>`, "gi")

  // Remove disallowed tags but keep content
  cleaned = cleaned.replace(tagRegex, "")

  // Clean up attributes on allowed tags - only keep safe attributes
  const safeAttrs = ["href", "src", "alt", "title", "class", "id"]
  const attrPattern = new RegExp(
    `(<(?:${allowedPattern})[^>]*?)\\s+(?!(?:${safeAttrs.join(
      "|"
    )})\\s*=)[a-z-]+\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]*)`,
    "gi"
  )

  // Iteratively remove unsafe attributes
  let prevCleaned = ""
  while (prevCleaned !== cleaned) {
    prevCleaned = cleaned
    cleaned = cleaned.replace(attrPattern, "$1")
  }

  return cleaned.trim()
}

/**
 * Sanitize plain text by stripping all HTML tags
 *
 * @param dirty - Untrusted text that may contain HTML
 * @returns Plain text with all HTML removed
 *
 * @example
 * const userInput = '<script>alert("xss")</script>Hello World';
 * const clean = sanitizePlainText(userInput);
 * // Result: 'Hello World'
 */
export function sanitizePlainText(dirty: string): string {
  if (!dirty || typeof dirty !== "string") {
    return ""
  }

  return stripHtmlTags(dirty)
}

/**
 * Sanitize message content for chat application
 * Allows basic formatting but strips dangerous content
 *
 * @param dirty - User message content
 * @returns Sanitized message safe for display
 */
export function sanitizeMessage(dirty: string): string {
  if (!dirty || typeof dirty !== "string") {
    return ""
  }

  // Remove script and style tags with their content first
  let cleaned = dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")

  // Remove all HTML tags but keep content
  cleaned = cleaned.replace(/<[^>]*>/g, "")

  // Decode HTML entities
  cleaned = cleaned.replace(
    /&(?:amp|lt|gt|quot|#x27|#39|#x2F|#x60|#x3D|nbsp);/gi,
    (entity) => DECODE_ENTITIES[entity.toLowerCase()] || entity
  )

  // Convert newlines to <br> tags (preserve line breaks)
  cleaned = cleaned.replace(/\n/g, "<br>")

  return cleaned.trim()
}

/**
 * Sanitize URL to prevent javascript: and data: URIs
 *
 * @param url - URL to sanitize
 * @returns Safe URL or empty string if invalid
 *
 * @example
 * sanitizeUrl('javascript:alert(1)'); // Returns: ''
 * sanitizeUrl('https://example.com'); // Returns: 'https://example.com'
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") {
    return ""
  }

  const trimmed = url.trim()

  // Block dangerous protocols
  const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:", "about:"]

  const lowerUrl = trimmed.toLowerCase()
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return ""
    }
  }

  // Allow only http, https, mailto, tel protocols
  const allowedProtocolRegex = /^(https?|mailto|tel):/i
  const protocolMatch = trimmed.match(/^([a-z][a-z0-9+.-]*:)/i)

  if (protocolMatch && !allowedProtocolRegex.test(protocolMatch[0])) {
    return ""
  }

  return trimmed
}

/**
 * Sanitize filename to prevent path traversal attacks
 *
 * @param filename - Original filename
 * @returns Safe filename
 *
 * @example
 * sanitizeFilename('../../../etc/passwd'); // Returns: 'etc_passwd'
 * sanitizeFilename('my file.txt'); // Returns: 'my_file.txt'
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return "unnamed"
  }

  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace invalid chars
    .replace(/^\.+/, "") // Remove leading dots
    .replace(/\.+$/, "") // Remove trailing dots
    .substring(0, 255) // Limit length
}

/**
 * Sanitize JSON string to prevent injection attacks
 *
 * @param jsonString - JSON string to sanitize
 * @returns Sanitized JSON string or null if invalid
 */
export function sanitizeJson(jsonString: string): string | null {
  if (!jsonString || typeof jsonString !== "string") {
    return null
  }

  try {
    // Parse and re-stringify to ensure it's valid JSON
    const parsed = JSON.parse(jsonString)
    return JSON.stringify(parsed)
  } catch {
    return null
  }
}

/**
 * Validate and sanitize email address
 *
 * @param email - Email address to validate
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return ""
  }

  const trimmed = email.trim().toLowerCase()

  // Basic email validation regex
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

  if (!emailRegex.test(trimmed)) {
    return ""
  }

  return trimmed
}

/**
 * Sanitize user input object by applying appropriate sanitization to each field
 *
 * @param input - User input object
 * @param schema - Schema defining sanitization rules for each field
 * @returns Sanitized object
 *
 * @example
 * const userInput = {
 *   message: '<script>alert("xss")</script>Hello',
 *   url: 'javascript:alert(1)',
 *   email: 'USER@EXAMPLE.COM'
 * };
 *
 * const sanitized = sanitizeObject(userInput, {
 *   message: 'plainText',
 *   url: 'url',
 *   email: 'email'
 * });
 * // Result: { message: 'Hello', url: '', email: 'user@example.com' }
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  input: T,
  schema: Record<keyof T, "html" | "plainText" | "message" | "url" | "email" | "filename">
): Partial<T> {
  const sanitized: Partial<T> = {}

  for (const [key, value] of Object.entries(input)) {
    const sanitizationType = schema[key as keyof T]

    if (!sanitizationType || typeof value !== "string") {
      continue
    }

    switch (sanitizationType) {
      case "html":
        sanitized[key as keyof T] = sanitizeHtml(value) as T[keyof T]
        break
      case "plainText":
        sanitized[key as keyof T] = sanitizePlainText(value) as T[keyof T]
        break
      case "message":
        sanitized[key as keyof T] = sanitizeMessage(value) as T[keyof T]
        break
      case "url":
        sanitized[key as keyof T] = sanitizeUrl(value) as T[keyof T]
        break
      case "email":
        sanitized[key as keyof T] = sanitizeEmail(value) as T[keyof T]
        break
      case "filename":
        sanitized[key as keyof T] = sanitizeFilename(value) as T[keyof T]
        break
      default:
        sanitized[key as keyof T] = value as T[keyof T]
    }
  }

  return sanitized
}
