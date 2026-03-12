import { type NextRequest } from "next/server"

import { getClerkFrontendApiOrigin } from "@/app/lib/clerk-proxy"

const CLERK_PROXY_PATH = "/api/clerk-proxy"
const NON_BODY_METHODS = new Set(["GET", "HEAD"])

function getProxyBaseUrl(request: NextRequest) {
  return `${request.nextUrl.origin}${CLERK_PROXY_PATH}`
}

function getUpstreamBaseUrl() {
  return new URL(`${getClerkFrontendApiOrigin()}/`)
}

function getUpstreamUrl(request: NextRequest, path?: string[]) {
  const url = getUpstreamBaseUrl()

  if (path && path.length > 0) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/${path.join("/")}`
  }

  url.search = request.nextUrl.search

  return url
}

function getForwardedFor(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.trim() || "127.0.0.1"
}

function getProxyHeaders(request: NextRequest) {
  const headers = new Headers(request.headers)

  headers.set("Clerk-Proxy-Url", getProxyBaseUrl(request))
  headers.set("Clerk-Secret-Key", process.env.CLERK_SECRET_KEY ?? "")
  headers.set("X-Forwarded-For", getForwardedFor(request))
  headers.set("Accept-Encoding", "identity")
  headers.delete("host")
  headers.delete("content-length")

  return headers
}

function rewriteRedirectLocation(location: string, request: NextRequest) {
  try {
    const upstreamBaseUrl = getUpstreamBaseUrl()
    const upstreamBasePath = upstreamBaseUrl.pathname.replace(/\/$/, "")
    const resolvedLocation = new URL(location, upstreamBaseUrl)

    if (
      resolvedLocation.origin !== upstreamBaseUrl.origin ||
      !resolvedLocation.pathname.startsWith(upstreamBasePath)
    ) {
      return location
    }

    const proxyBaseUrl = new URL(`${getProxyBaseUrl(request)}/`)
    const proxyBasePath = proxyBaseUrl.pathname.replace(/\/$/, "")
    const proxyPathSuffix = resolvedLocation.pathname.slice(upstreamBasePath.length)
    const rewrittenUrl = new URL(`${proxyBaseUrl.origin}${proxyBasePath}${proxyPathSuffix}`)
    rewrittenUrl.search = resolvedLocation.search
    rewrittenUrl.hash = resolvedLocation.hash

    return rewrittenUrl.toString()
  } catch {
    return location
  }
}

function getResponseHeaders(upstreamHeaders: Headers, request: NextRequest) {
  const headers = new Headers(upstreamHeaders)
  const location = headers.get("location")

  headers.delete("content-encoding")
  headers.delete("content-length")
  headers.delete("transfer-encoding")

  if (location) {
    headers.set("location", rewriteRedirectLocation(location, request))
  }

  return headers
}

async function handleRequest(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params
  const upstreamResponse = await fetch(getUpstreamUrl(request, path), {
    method: request.method,
    headers: getProxyHeaders(request),
    body: NON_BODY_METHODS.has(request.method) ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  })

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: getResponseHeaders(upstreamResponse.headers, request),
  })
}

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export {
  handleRequest as GET,
  handleRequest as POST,
  handleRequest as PUT,
  handleRequest as PATCH,
  handleRequest as DELETE,
  handleRequest as HEAD,
  handleRequest as OPTIONS,
}
