import { NextResponse, type NextRequest } from "next/server"

import { apiLogger } from "@/app/lib/logger"
import {
  buildAffiliateUrl,
  getAffiliatePartner,
  monetizationConfig,
  normalizeAffiliateSource,
} from "@/app/lib/monetization"
import prisma from "@/app/lib/prismadb"
import { apiLimiter, getClientIdentifier } from "@/app/lib/rate-limit"

interface RouteParams {
  params: Promise<{
    partnerId: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { partnerId } = await params
  const identifier = getClientIdentifier(request)
  const allowed = await Promise.resolve(apiLimiter.check(identifier))

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  if (!monetizationConfig.enableAffiliateLinks) {
    return NextResponse.json({ error: "Affiliate links are disabled." }, { status: 404 })
  }

  const partner = getAffiliatePartner(partnerId)
  if (!partner) {
    return NextResponse.json({ error: "Affiliate partner not found." }, { status: 404 })
  }

  const source = normalizeAffiliateSource(request.nextUrl.searchParams.get("source"))
  const destination = buildAffiliateUrl(partner.url, source, partner.id)

  let destinationUrl: URL
  try {
    destinationUrl = new URL(destination)
  } catch {
    apiLogger.error(
      { event: "affiliate_click_invalid_destination", partnerId: partner.id, destination },
      "Affiliate destination URL is invalid"
    )
    return NextResponse.json({ error: "Affiliate destination is misconfigured." }, { status: 500 })
  }

  apiLogger.info(
    {
      event: "affiliate_click",
      partnerId: partner.id,
      partnerName: partner.name,
      source,
      destinationHost: destinationUrl.host,
      referrer: request.headers.get("referer") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
      clientId: identifier,
    },
    "Affiliate link click"
  )

  try {
    await prisma.affiliateClick.create({
      data: {
        partnerId: partner.id,
        source,
        destinationUrl: destinationUrl.toString(),
        destinationHost: destinationUrl.host,
        referrer: request.headers.get("referer")?.slice(0, 1024) ?? null,
        userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
        clientIp: identifier.slice(0, 128),
      },
    })
  } catch (error) {
    apiLogger.error(
      {
        event: "affiliate_click_persist_failed",
        partnerId: partner.id,
        source,
        destinationHost: destinationUrl.host,
        err: error,
      },
      "Failed to persist affiliate click analytics"
    )
  }

  const response = NextResponse.redirect(destinationUrl.toString(), 302)
  response.headers.set("Cache-Control", "no-store")
  return response
}
