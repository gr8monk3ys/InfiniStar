import { withSentryConfig } from "@sentry/nextjs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function isEnabled(value) {
  if (!value) {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function buildDefaultContentSecurityPolicy(reportUri) {
  const directives = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["object-src", ["'none'"]],
    [
      "script-src",
      [
        "'self'",
        "'unsafe-inline'",
        "https://js.stripe.com",
        "https://*.clerk.com",
        "https://*.clerk.accounts.dev",
        "https://www.googletagmanager.com",
        "https://pagead2.googlesyndication.com",
      ],
    ],
    ["style-src", ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]],
    [
      "img-src",
      [
        "'self'",
        "data:",
        "blob:",
        "https://avatars.githubusercontent.com",
        "https://lh3.googleusercontent.com",
        "https://res.cloudinary.com",
        "https://www.googletagmanager.com",
        "https://googleads.g.doubleclick.net",
        "https://tpc.googlesyndication.com",
      ],
    ],
    ["font-src", ["'self'", "data:", "https://fonts.gstatic.com"]],
    [
      "connect-src",
      [
        "'self'",
        "https://api.clerk.com",
        "https://*.clerk.com",
        "https://*.clerk.accounts.dev",
        "https://api.stripe.com",
        "https://*.pusher.com",
        "https://sockjs.pusher.com",
        "wss://*.pusher.com",
        "https://*.ingest.sentry.io",
        "https://www.google-analytics.com",
        "https://googleads.g.doubleclick.net",
        "https://pagead2.googlesyndication.com",
      ],
    ],
    [
      "frame-src",
      [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
        "https://checkout.stripe.com",
        "https://googleads.g.doubleclick.net",
      ],
    ],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["form-action", ["'self'", "https://checkout.stripe.com"]],
    ["upgrade-insecure-requests", []],
  ]

  if (reportUri) {
    directives.push(["report-uri", [reportUri]])
  }

  return directives
    .map(([directive, values]) =>
      values.length > 0 ? `${directive} ${values.join(" ")}` : `${directive}`
    )
    .join("; ")
}

function buildSecurityHeaders() {
  const customPolicy = process.env.CONTENT_SECURITY_POLICY?.trim()
  const reportUri = process.env.CONTENT_SECURITY_POLICY_REPORT_URI?.trim()
  const cspHeaderKey = isEnabled(process.env.CONTENT_SECURITY_POLICY_REPORT_ONLY)
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy"
  const cspHeaderValue =
    customPolicy && customPolicy.length > 0
      ? customPolicy
      : buildDefaultContentSecurityPolicy(reportUri)

  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: cspHeaderKey, value: cspHeaderValue },
  ]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
}

const shouldEnableSentry = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
)

const sentryPluginOptions = shouldEnableSentry
  ? {
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
    }
  : undefined

export default shouldEnableSentry
  ? withSentryConfig(nextConfig, sentryPluginOptions)
  : nextConfig
