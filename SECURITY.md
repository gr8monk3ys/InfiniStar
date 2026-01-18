# Security Features

## Overview

InfiniStar implements multiple layers of security to protect user data and prevent abuse.

## Implemented Security Features

### 1. Rate Limiting

All API endpoints are protected with rate limiting to prevent abuse and DoS attacks.

**Limits:**

- **General API endpoints** (`/api/messages`, `/api/conversations`): 60 requests per minute
- **Authentication endpoints** (`/api/register`): 5 requests per 5 minutes
- **AI Chat endpoint** (`/api/ai/chat`): 20 requests per minute

**Implementation:**

- In-memory rate limiter (suitable for development)
- Returns 429 status code when limit exceeded
- Includes `Retry-After` header

**Location:** [app/lib/rate-limit.ts](app/lib/rate-limit.ts)

**Usage Example:**

```typescript
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

export async function POST(request: NextRequest) {
  const identifier = getClientIdentifier(request)
  if (!apiLimiter.check(identifier)) {
    return new NextResponse("Too many requests", { status: 429 })
  }
  // ... handle request
}
```

### 2. Authentication & Authorization

- **NextAuth.js** for session management
- **JWT strategy** for stateless authentication
- **Session validation** on all protected routes
- **User ID verification** before data access

### 3. Input Validation

- **Zod schemas** for request validation
- **Email format validation** on registration
- **Password requirements**: Minimum 8 characters
- **Duplicate email prevention**

**Example** ([app/api/register/route.ts](app/api/register/route.ts)):

```typescript
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})
```

### 4. Password Security

- **Bcrypt hashing** with salt rounds of 12
- **No plaintext storage** of passwords
- **Secure password comparison**

### 5. Database Security

- **Prisma ORM** prevents SQL injection
- **MongoDB** with parameterized queries
- **Connection string** stored in environment variables
- **No direct query exposure** to client

### 6. API Security

- **HTTPS only** in production (recommended)
- **CORS** configured for specific origins
- **JSON-only responses** to prevent MIME sniffing
- **Error messages** don't expose system details

### 7. CSRF Protection ✅

InfiniStar implements CSRF (Cross-Site Request Forgery) protection using the **Double Submit Cookie** pattern.

**Implementation Details:**

- Cryptographically secure tokens (32 bytes, 256 bits)
- HTTP-only cookies prevent JavaScript access
- Timing-safe comparison prevents timing attacks
- SameSite=Strict cookie attribute
- Secure flag in production (HTTPS only)

**Protected Endpoints:**

- `/api/messages` - Message creation
- `/api/ai/chat` - AI chat messages
- All mutation endpoints (POST, PUT, PATCH, DELETE)

**Location:** [app/lib/csrf.ts](app/lib/csrf.ts)

**Documentation:** [CSRF_PROTECTION.md](CSRF_PROTECTION.md)

**Usage Example:**

```typescript
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

const { token } = useCsrfToken()

await fetch("/api/messages", {
  method: "POST",
  headers: { "X-CSRF-Token": token },
  body: JSON.stringify(data),
})
```

### 8. Security Headers ✅

Comprehensive security headers configured via Next.js middleware:

**Implemented Headers:**

- **Content-Security-Policy (CSP)**: Restricts resource loading
- **X-Frame-Options**: DENY - prevents clickjacking
- **X-Content-Type-Options**: nosniff - prevents MIME sniffing
- **X-XSS-Protection**: 1; mode=block - enables XSS filter
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Restricts browser features (camera, mic, etc.)
- **Strict-Transport-Security (HSTS)**: Production only, 2 years max-age

**Location:** [middleware.ts](middleware.ts)

### 9. Input Sanitization ✅

Comprehensive input sanitization protects against XSS attacks and other injection vulnerabilities.

**Sanitization Functions:**

- `sanitizeHtml()` - Allows safe HTML tags, strips dangerous content
- `sanitizePlainText()` - Removes all HTML tags
- `sanitizeMessage()` - Chat message sanitization with line breaks
- `sanitizeUrl()` - Validates URLs, blocks javascript:, data:, file: protocols
- `sanitizeFilename()` - Prevents path traversal attacks
- `sanitizeEmail()` - Email validation and normalization
- `escapeHtml()` - HTML entity escaping

**Protected Endpoints:**

- `/api/messages` - Message body and image URLs
- `/api/ai/chat` - User messages to AI
- `/api/conversations` - Conversation names

**Location:** [app/lib/sanitize.ts](app/lib/sanitize.ts)

**Test Coverage:** 27 passing tests validating all sanitization functions

**Usage Example:**

```typescript
import { sanitizeMessage, sanitizeUrl } from "@/app/lib/sanitize"

// In API route
const sanitizedMessage = sanitizeMessage(userInput)
const sanitizedImage = sanitizeUrl(imageUrl)

await prisma.message.create({
  data: {
    body: sanitizedMessage,
    image: sanitizedImage,
    // ...
  },
})
```

### 10. CORS (Cross-Origin Resource Sharing) ✅

Proper CORS configuration prevents unauthorized cross-origin access while allowing legitimate requests.

**Configuration:**

- **Development**: Allows localhost on ports 3000, 3001 and .local domains
- **Production**: Only allows configured `NEXT_PUBLIC_APP_URL`
- **Preflight Handling**: Automatic OPTIONS request handling
- **Credentials**: Supports cookies and authorization headers

**CORS Headers:**

- `Access-Control-Allow-Origin`: Validated origin or blocked
- `Access-Control-Allow-Credentials`: true (supports auth cookies)
- `Access-Control-Allow-Methods`: GET, POST, PUT, PATCH, DELETE, OPTIONS
- `Access-Control-Allow-Headers`: Content-Type, Authorization, X-CSRF-Token
- `Access-Control-Expose-Headers`: X-CSRF-Token, rate limit headers
- `Access-Control-Max-Age`: 86400 (24 hours preflight cache)

**Location:** [app/lib/cors.ts](app/lib/cors.ts), [middleware.ts](middleware.ts)

**Test Coverage:** 17 passing tests for origin validation and header generation

**Usage Example:**

```typescript
// CORS is automatically applied via middleware
// To configure allowed origins in production:
// Set NEXT_PUBLIC_APP_URL=https://yourdomain.com

// Custom CORS for specific API routes (if needed):
import { getCorsHeaders } from "@/app/lib/cors"

const origin = request.headers.get("origin")
const corsHeaders = getCorsHeaders(origin)

Object.entries(corsHeaders).forEach(([key, value]) => {
  response.headers.set(key, value)
})
```

### 11. Email Verification ✅

Token-based email verification system ensures users own the email addresses they register with.

**Implementation Details:**

- Cryptographically secure tokens (32 bytes hex, 64 characters)
- 24-hour expiry for verification links
- Verification required before full account access
- Rate-limited resend functionality
- Automatic welcome email after verification

**Features:**

- `/api/auth/verify-email` - Token verification endpoint
- `/api/auth/resend-verification` - Rate-limited resend (5 req/5 min)
- `/verify-email` - User-facing verification page
- `/resend-verification` - Request new verification link

**Database Fields:**

- `verificationToken` - Unique verification token
- `verificationTokenExpiry` - Token expiration timestamp
- `emailVerified` - Verification completion date

**Location:** [app/lib/email-verification.ts](app/lib/email-verification.ts), [app/lib/email.ts](app/lib/email.ts)

**Usage Flow:**

1. User registers → Verification token generated
2. Email sent with verification link (24h expiry)
3. User clicks link → Token validated
4. Email verified → Welcome email sent
5. Failed/expired tokens → Resend option available

**Development Mode:**

- Verification emails logged to console
- Includes full verification URL for testing
- Production-ready structure for email service integration

**Security:**

- Tokens use crypto.randomBytes (cryptographically secure)
- Tokens hashed for storage (coming soon)
- Rate limiting on resend endpoint
- No user enumeration (consistent responses)

### 12. Password Reset ✅

Secure token-based password reset system allows users to recover their accounts.

**Implementation Details:**

- Cryptographically secure tokens (32 bytes hex, 64 characters)
- 24-hour token expiry
- Rate-limited endpoints (5 requests/5 minutes)
- No user enumeration (consistent responses)
- Automatic token invalidation after use

**Features:**

- `/api/auth/request-reset` - Request password reset (rate-limited)
- `/api/auth/reset-password` - Reset password with valid token
- `/forgot-password` - Request reset link page
- `/reset-password` - Password reset form page

**Database Fields:**

- `resetToken` - Unique reset token (same schema as verification)
- `resetTokenExpiry` - Token expiration timestamp
- Shared token generation utilities with email verification

**Location:** [app/lib/email-verification.ts](app/lib/email-verification.ts), [app/lib/email.ts](app/lib/email.ts)

**Usage Flow:**

1. User requests password reset → Token generated
2. Email sent with reset link (24h expiry)
3. User clicks link → Enters new password
4. Password validated and hashed
5. Token cleared, password updated
6. User can log in with new password

**Development Mode:**

- Reset emails logged to console
- Includes full reset URL for testing
- Production-ready structure for email service integration

**Security:**

- Bcrypt password hashing (12 rounds)
- Input validation with Zod schema
- Minimum 8 character password requirement
- Rate limiting prevents brute force
- No user enumeration (same response for existing/non-existing emails)
- Token invalidated immediately after successful reset

## Planned Security Enhancements

### High Priority

- [ ] **Redis Rate Limiting**: Move from in-memory to Redis for production
- [ ] **Session Expiry**: Implement automatic session timeout

### Medium Priority

- [ ] **2FA**: Two-factor authentication support
- [ ] **Audit Logging**: Log all security-relevant events
- [ ] **IP Blocking**: Block suspicious IPs automatically
- [ ] **Content Sanitization**: Sanitize user-generated content
- [ ] **File Upload Validation**: Validate image uploads
- [ ] **Webhook Signature Verification**: Verify Stripe webhooks properly

### Low Priority

- [ ] **Penetration Testing**: Regular security audits
- [ ] **Dependency Scanning**: Automated vulnerability scans
- [ ] **Security Headers Testing**: Use securityheaders.com
- [ ] **Rate Limit Analytics**: Track and analyze rate limit hits

## Security Best Practices

### For Developers

1. **Never commit secrets** - Use `.env.local` for sensitive data
2. **Validate all input** - Never trust client data
3. **Use parameterized queries** - Always use Prisma, never raw SQL
4. **Hash passwords** - Never store plaintext passwords
5. **Check permissions** - Verify user has access before operations
6. **Log security events** - Track failed auth attempts, rate limits
7. **Keep dependencies updated** - Run `npm audit` regularly

### For Production Deployment

1. **Use HTTPS** - Always encrypt traffic
2. **Set secure headers** - Configure CSP, HSTS, etc.
3. **Use Redis for rate limiting** - In-memory won't work with multiple instances
4. **Enable monitoring** - Use Sentry or similar
5. **Backup database** - Regular automated backups
6. **Rotate secrets** - Change API keys periodically
7. **Review logs** - Monitor for suspicious activity

## Reporting Security Issues

If you discover a security vulnerability, please email security@yourdomain.com instead of creating a public issue.

**Please include:**

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Security Checklist for PRs

Before merging code that touches security-sensitive areas:

- [ ] Input validation added for all new endpoints
- [ ] Authentication/authorization checks in place
- [ ] Rate limiting applied to new endpoints
- [ ] No secrets in code or logs
- [ ] Error messages don't leak system info
- [ ] Tests include security scenarios
- [ ] Documentation updated

## Compliance

This application follows security best practices from:

- **OWASP Top 10** guidelines
- **Next.js Security** recommendations
- **Vercel** security best practices
- **Anthropic** responsible AI guidelines

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [NextAuth.js Security](https://next-auth.js.org/security)
- [Stripe Security](https://stripe.com/docs/security)

---

Last Updated: January 2025
