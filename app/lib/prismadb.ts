import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"

declare global {
  var prisma: PrismaClient | undefined
}

/**
 * SSL modes that `pg` currently treats as aliases for `verify-full`.
 *
 * `pg-connection-string` v3 and `pg` v9 adopt libpq semantics, under which
 * `prefer`, `require` and `verify-ca` stop being aliases for `verify-full` and
 * become weaker. Every production runtime log event today is that deprecation
 * warning. Naming the mode we already get keeps today's behavior after the
 * upgrade instead of silently loosening certificate verification.
 *
 * `disable` is deliberately not in this set: a local or containerised database
 * has no certificate to verify, and upgrading it would break development and
 * the integration suite.
 *
 * `DIRECT_URL` is deliberately out of scope. It is consumed only by
 * `prisma.config.ts`, which hands it to Prisma's own schema engine for
 * migrations — that engine parses its own connection string and never goes
 * through the `pg` / `pg-connection-string` packages this deprecation belongs
 * to.
 */
const IMPLICIT_VERIFY_FULL_MODES = new Set(["prefer", "require", "verify-ca"])

export function withExplicitSslMode(url: string): string {
  try {
    const parsed = new URL(url)
    const mode = parsed.searchParams.get("sslmode")
    if (mode && IMPLICIT_VERIFY_FULL_MODES.has(mode)) {
      parsed.searchParams.set("sslmode", "verify-full")
      return parsed.toString()
    }
    return url
  } catch {
    // Not a parseable URL. Prisma will produce a better error than we can.
    return url
  }
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured")
}

const adapter = new PrismaPg(new Pool({ connectionString: withExplicitSslMode(databaseUrl) }))

const client = globalThis.prisma || new PrismaClient({ adapter })
if (process.env.NODE_ENV !== "production") globalThis.prisma = client

export default client
export { client as db }
