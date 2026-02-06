import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import { PrismaClient } from "@prisma/client"
import ws from "ws"

declare global {
  var prisma: PrismaClient | undefined
}

neonConfig.webSocketConstructor = ws

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured")
}

const adapter = new PrismaNeon({ connectionString: databaseUrl })

const client = globalThis.prisma || new PrismaClient({ adapter })
if (process.env.NODE_ENV !== "production") globalThis.prisma = client

export default client
export { client as db }
