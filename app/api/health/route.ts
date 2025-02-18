import { NextResponse } from "next/server"

import prisma from "@/app/lib/prismadb"
import { isRedisAvailable } from "@/app/lib/redis"

export async function GET(): Promise<NextResponse> {
  const timestamp = new Date().toISOString()

  try {
    await prisma.$queryRaw`SELECT 1`

    const redisConfigured = Boolean(process.env.REDIS_URL)
    const redisAvailable = redisConfigured ? await isRedisAvailable() : false
    const shouldRequireRedisInProd = process.env.NODE_ENV === "production"

    const status =
      shouldRequireRedisInProd && (!redisConfigured || !redisAvailable) ? "degraded" : "ok"

    return NextResponse.json(
      {
        status,
        timestamp,
        database: "connected",
        redis: redisConfigured ? (redisAvailable ? "connected" : "disconnected") : "not_configured",
      },
      { status: status === "ok" ? 200 : 503 }
    )
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp,
        database: "disconnected",
        error: "Database unreachable",
      },
      { status: 503 }
    )
  }
}
