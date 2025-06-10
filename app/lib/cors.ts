/**
 * CORS Configuration
 *
 * Configures Cross-Origin Resource Sharing (CORS) headers for API security.
 * Controls which origins can access the API and what methods/headers are allowed.
 */

/**
 * Allowed origins for CORS
 * In production, this should be restricted to your actual domain(s)
 */
export function getAllowedOrigins(): string[] {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const nodeEnv = process.env.NODE_ENV

  if (nodeEnv === "development") {
    // In development, allow localhost on common ports
    return [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ]
  }

  // In production, only allow the configured app URL
  if (appUrl) {
    return [appUrl]
  }

  // Fallback: no origins allowed (most restrictive)
  return []
}

/**
 * Check if an origin is allowed based on CORS policy
 *
 * @param origin - The origin to check
 * @returns true if origin is allowed, false otherwise
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    // Same-origin requests don't have an Origin header
    return true
  }

  const allowedOrigins = getAllowedOrigins()

  // Check exact match
  if (allowedOrigins.includes(origin)) {
    return true
  }

  // In development, be more permissive with localhost variations
  if (process.env.NODE_ENV === "development") {
    try {
      const url = new URL(origin)
      if (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname.endsWith(".local")
      ) {
        return true
      }
    } catch {
      return false
    }
  }

  return false
}

/**
 * Get CORS headers for a given origin
 *
 * @param origin - The request origin
 * @param options - CORS options
 * @returns Object containing CORS headers
 */
export function getCorsHeaders(
  origin: string | null,
  options: {
    allowCredentials?: boolean
    maxAge?: number
    allowedMethods?: string[]
    allowedHeaders?: string[]
    exposedHeaders?: string[]
  } = {}
): Record<string, string> {
  const {
    allowCredentials = true,
    maxAge = 86400, // 24 hours
    allowedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders = ["Content-Type", "Authorization", "X-CSRF-Token", "X-Requested-With"],
    exposedHeaders = ["X-CSRF-Token"],
  } = options

  const headers: Record<string, string> = {}

  // Set Access-Control-Allow-Origin
  if (isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin || "*"
  } else {
    // For disallowed origins, don't set CORS headers
    // The browser will block the request
    return {}
  }

  // Set Access-Control-Allow-Credentials
  if (allowCredentials) {
    headers["Access-Control-Allow-Credentials"] = "true"
  }

  // Set Access-Control-Allow-Methods
  headers["Access-Control-Allow-Methods"] = allowedMethods.join(", ")

  // Set Access-Control-Allow-Headers
  headers["Access-Control-Allow-Headers"] = allowedHeaders.join(", ")

  // Set Access-Control-Expose-Headers
  if (exposedHeaders.length > 0) {
    headers["Access-Control-Expose-Headers"] = exposedHeaders.join(", ")
  }

  // Set Access-Control-Max-Age (cache preflight for 24 hours)
  headers["Access-Control-Max-Age"] = maxAge.toString()

  // Add Vary header to indicate that the response varies by Origin
  headers["Vary"] = "Origin"

  return headers
}

/**
 * Handle CORS preflight (OPTIONS) request
 *
 * @param origin - The request origin
 * @returns Response object for preflight
 */
export function handleCorsPreflightRequest(origin: string | null): Response {
  const corsHeaders = getCorsHeaders(origin)

  // If origin is not allowed, return 403
  if (Object.keys(corsHeaders).length === 0) {
    return new Response("Forbidden", { status: 403 })
  }

  // Return 204 No Content with CORS headers
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

/**
 * Middleware helper to add CORS headers to a response
 *
 * @param response - The response object
 * @param origin - The request origin
 * @returns Response with CORS headers added
 */
export function addCorsHeaders(response: Response, origin: string | null): Response {
  const corsHeaders = getCorsHeaders(origin)

  // Clone the response to add headers
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })

  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newResponse.headers.set(key, value)
  })

  return newResponse
}

/**
 * Constants for CORS configuration
 */
export const CORS_CONFIG = {
  // Standard HTTP methods that require CORS
  CORS_METHODS: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  // Headers that can be sent from client
  ALLOWED_HEADERS: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-Requested-With",
    "Accept",
    "Accept-Language",
    "Content-Language",
  ],

  // Headers that can be exposed to client
  EXPOSED_HEADERS: ["X-CSRF-Token", "X-RateLimit-Limit", "X-RateLimit-Remaining"],

  // Cache preflight responses for 24 hours
  MAX_AGE: 86400,
} as const
