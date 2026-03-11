import { type NextRequest } from "next/server"

const CLERK_PROXY_PATH = "/api/clerk-proxy"
const CLERK_FRONTEND_API_ORIGIN = "https://frontend-api.clerk.dev"
const NON_BODY_METHODS = new Set(["GET", "HEAD"])

function getProxyBaseUrl(request: NextRequest) {
  return `${request.nextUrl.origin}${CLERK_PROXY_PATH}`
}

function getUpstreamUrl(request: NextRequest, path?: string[]) {
  const upstreamPath = path?.join("/") ?? ""
  const url = new URL(
    upstreamPath ? `${CLERK_FRONTEND_API_ORIGIN}/${upstreamPath}` : CLERK_FRONTEND_API_ORIGIN
  )

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

function getResponseHeaders(upstreamHeaders: Headers) {
  const headers = new Headers(upstreamHeaders)

  headers.delete("content-encoding")
  headers.delete("content-length")
  headers.delete("transfer-encoding")

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
    headers: getResponseHeaders(upstreamResponse.headers),
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
