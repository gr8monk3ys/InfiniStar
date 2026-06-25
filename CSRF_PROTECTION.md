# CSRF Protection Implementation

## Overview

This application implements CSRF (Cross-Site Request Forgery) protection using the **Double Submit Cookie** pattern to prevent unauthorized actions on behalf of authenticated users.

## How It Works

### Double Submit Cookie Pattern

1. **Token Generation**: The server generates a cryptographically secure random token
2. **Cookie Storage**: The token is stored in an HTTP-only cookie (`csrf-token`)
3. **Header Transmission**: The client receives the token and includes it in the `X-CSRF-Token` header
4. **Token Verification**: The server compares the header token with the cookie token using timing-safe comparison

### Security Features

- **Cryptographically Secure**: Uses `crypto.randomBytes()` for token generation
- **HTTP-Only Cookies**: Prevents JavaScript access to cookie, protecting against XSS
- **Timing-Safe Comparison**: Prevents timing attacks using `crypto.timingSafeEqual()`
- **SameSite Strict**: Cookie `SameSite=Strict` attribute prevents CSRF in most scenarios
- **Secure Flag**: Cookies marked as `Secure` in production (HTTPS only)

---

## Implementation

### Server-Side

#### 1. CSRF Utility (`app/lib/csrf.ts`)

Core functions for token generation and verification:

```typescript
import { createCsrfCookie, generateCsrfToken, verifyCsrfToken } from "@/app/lib/csrf"

// Generate new token
const token = generateCsrfToken()

// Verify token from request
const isValid = verifyCsrfToken(headerToken, cookieToken)

// Create cookie header
const cookie = createCsrfCookie(token)
```

**Key Functions:**

- `generateCsrfToken()` - Generate 32-byte random hex token
- `verifyCsrfToken(headerToken, cookieToken)` - Timing-safe token comparison
- `createCsrfCookie(token, options?)` - Create Set-Cookie header value
- `withCsrfProtection(handler)` - HOF to wrap API routes with CSRF protection

#### 2. CSRF Token Endpoint (`app/api/csrf/route.ts`)

Endpoint to generate and retrieve CSRF tokens:

```
GET /api/csrf
```

**Response:**

```json
{
  "token": "abc123...",
  "message": "CSRF token generated"
}
```

**Sets Cookie:**

```
Set-Cookie: csrf-token=abc123...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400
```

#### 3. Protected API Routes

Add CSRF verification to mutation endpoints (POST, PUT, PATCH, DELETE):

```typescript
import { verifyCsrfToken } from "@/app/lib/csrf"

export async function POST(request: NextRequest) {
  // CSRF Protection
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    cookieToken = cookies["csrf-token"] || null
  }

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return new NextResponse(
      JSON.stringify({
        error: "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  // Continue with request handling...
}
```

**Protected Endpoints:**

- ✅ `/api/messages` - Message creation
- ✅ `/api/ai/chat` - AI chat messages
- `/api/conversations` - Conversation creation/deletion
- `/api/register` - User registration
- `/api/settings` - User settings updates

### Client-Side

#### 1. CSRF Hook (`app/hooks/useCsrfToken.ts`)

React hook to fetch and manage CSRF token:

```typescript
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

function MyComponent() {
  const { token, loading, error } = useCsrfToken()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  // Use token in API calls
  const handleSubmit = async () => {
    await fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token,
      },
      body: JSON.stringify(data),
    })
  }
}
```

#### 2. Form Integration

Example: Message Form Component

```typescript
"use client"

import axios from "axios"

import { useCsrfToken } from "@/app/hooks/useCsrfToken"

const Form = () => {
  const { token: csrfToken, loading: csrfLoading } = useCsrfToken()

  const handleSubmit = async (data) => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh.")
      return
    }

    await axios.post("/api/messages", data, {
      headers: { "X-CSRF-Token": csrfToken },
    })
  }

  // Disable form while CSRF token is loading
  return (
    <form onSubmit={handleSubmit}>
      <button disabled={csrfLoading || !csrfToken}>Submit</button>
    </form>
  )
}
```

---

## Usage Guide

### Adding CSRF Protection to a New API Route

**Step 1:** Import CSRF verification

```typescript
import { verifyCsrfToken } from "@/app/lib/csrf"
```

**Step 2:** Add CSRF check at the beginning of your handler

```typescript
export async function POST(request: NextRequest) {
  // CSRF Protection
  const headerToken = request.headers.get("X-CSRF-Token")
  const cookieHeader = request.headers.get("cookie")
  let cookieToken: string | null = null

  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=")
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    cookieToken = cookies["csrf-token"] || null
  }

  if (!verifyCsrfToken(headerToken, cookieToken)) {
    return new NextResponse(
      JSON.stringify({
        error: "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    )
  }

  // Your route logic here...
}
```

**Step 3 (Alternative):** Use the HOF wrapper

```typescript
import { withCsrfProtection } from "@/app/lib/csrf"

export const POST = withCsrfProtection(async (request: NextRequest) => {
  // Your route logic - CSRF is automatically verified
  const body = await request.json()
  // ...
})
```

### Adding CSRF Token to Client Requests

**Option 1: Using the Hook**

```typescript
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

const { token } = useCsrfToken()

await fetch("/api/endpoint", {
  method: "POST",
  headers: { "X-CSRF-Token": token },
  body: JSON.stringify(data),
})
```

**Option 2: With Axios**

```typescript
import axios from "axios"

import { useCsrfToken } from "@/app/hooks/useCsrfToken"

const { token } = useCsrfToken()

await axios.post("/api/endpoint", data, {
  headers: { "X-CSRF-Token": token },
})
```

**Option 3: Global Axios Interceptor**

```typescript
// app/lib/axios.ts
import axios from "axios"

export const configureAxios = (csrfToken: string) => {
  axios.interceptors.request.use((config) => {
    if (["post", "put", "patch", "delete"].includes(config.method || "")) {
      config.headers["X-CSRF-Token"] = csrfToken
    }
    return config
  })
}
```

---

## Testing

### Manual Testing

**1. Test Valid Token:**

```bash
# Get token
curl -c cookies.txt http://localhost:3000/api/csrf

# Extract token from response
TOKEN="<token from response>"

# Make authenticated request
curl -b cookies.txt \
  -H "X-CSRF-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"message": "Hello"}' \
  http://localhost:3000/api/messages
```

**2. Test Missing Token (should fail):**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}' \
  http://localhost:3000/api/messages

# Expected: 403 Forbidden
```

**3. Test Invalid Token (should fail):**

```bash
curl -b cookies.txt \
  -H "X-CSRF-Token: invalid_token" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"message": "Hello"}' \
  http://localhost:3000/api/messages

# Expected: 403 Forbidden
```

### Automated Testing

```typescript
// __tests__/csrf.test.ts
import { generateCsrfToken, verifyCsrfToken } from "@/app/lib/csrf"

describe("CSRF Protection", () => {
  it("should generate valid token", () => {
    const token = generateCsrfToken()
    expect(token).toHaveLength(64) // 32 bytes = 64 hex chars
  })

  it("should verify matching tokens", () => {
    const token = generateCsrfToken()
    expect(verifyCsrfToken(token, token)).toBe(true)
  })

  it("should reject mismatched tokens", () => {
    const token1 = generateCsrfToken()
    const token2 = generateCsrfToken()
    expect(verifyCsrfToken(token1, token2)).toBe(false)
  })

  it("should reject null tokens", () => {
    expect(verifyCsrfToken(null, null)).toBe(false)
    expect(verifyCsrfToken("valid", null)).toBe(false)
    expect(verifyCsrfToken(null, "valid")).toBe(false)
  })
})
```

---

## Security Considerations

### ✅ Implemented

- **Cryptographically Secure Tokens**: Using `crypto.randomBytes()` with 32 bytes (256 bits)
- **HTTP-Only Cookies**: JavaScript cannot access the token cookie
- **Timing-Safe Comparison**: Prevents timing attacks using `crypto.timingSafeEqual()`
- **SameSite Strict**: Cookies only sent for same-site requests
- **Secure Flag**: Cookies transmitted over HTTPS only in production
- **Token Rotation**: New token generated on each `/api/csrf` request

### ⚠️ Important Notes

1. **HTTPS Required in Production**: CSRF protection relies on secure cookies (`Secure` flag)
2. **SameSite=Strict**: May cause issues with OAuth redirects - consider `SameSite=Lax` for auth flows
3. **Token Lifetime**: Tokens expire after 24 hours (configurable via `maxAge`)
4. **Single-Page Apps**: SPA must fetch token before making first mutation request
5. **API-Only Clients**: Native mobile apps may need alternative auth (API keys, OAuth)

### 🔄 Future Enhancements

- [ ] Token refresh mechanism
- [ ] Per-session token tracking (requires Redis/database)
- [ ] CSRF token in meta tags for SSR forms
- [ ] Automatic token rotation on authentication events
- [ ] Integration with NextAuth.js CSRF tokens

---

## Troubleshooting

### Issue: "Invalid CSRF token" on valid requests

**Possible Causes:**

1. Token expired (24-hour lifetime)
2. Cookie not sent with request (check `credentials: 'include'`)
3. Token fetched from different domain/subdomain
4. Cookie blocked by browser (third-party cookie settings)

**Solutions:**

- Refresh token by calling `/api/csrf` again
- Ensure `credentials: 'include'` in fetch options
- Check browser console for cookie warnings
- Verify SameSite and Secure cookie attributes

### Issue: CSRF hook returns null token

**Possible Causes:**

1. `/api/csrf` endpoint not responding
2. Network error during token fetch
3. Cookie rejected by browser

**Solutions:**

- Check browser network tab for failed requests
- Verify `/api/csrf` endpoint is accessible
- Check `useCsrfToken` hook error state: `const { token, error } = useCsrfToken()`

### Issue: Token works in development but not production

**Possible Causes:**

1. HTTPS not configured (Secure flag requires HTTPS)
2. Domain mismatch (cookie domain must match)
3. Proxy/load balancer stripping headers

**Solutions:**

- Ensure production uses HTTPS
- Verify cookie domain settings
- Check proxy configuration for header forwarding

---

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Double Submit Cookie Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [Node.js crypto module](https://nodejs.org/api/crypto.html)

---

**Last Updated:** January 2025
**Status:** ✅ Implemented and tested
