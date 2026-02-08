import { NextResponse } from 'next/server'

import prisma from '@/app/lib/prismadb'

export async function GET(): Promise<NextResponse> {
  const timestamp = new Date().toISOString()

  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      {
        status: 'ok',
        timestamp,
        database: 'connected',
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp,
        database: 'disconnected',
        error: 'Database unreachable',
      },
      { status: 503 }
    )
  }
}
