import "dotenv/config"

import { defineConfig } from "prisma/config"

const directUrl = process.env.DIRECT_URL

// Fall back to a placeholder so `prisma generate` (run from postinstall) works on
// fresh clones and CI without a configured database. Commands that actually connect
// (migrate, studio, db push) still require a real DATABASE_URL to succeed.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/infinistar"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
    ...(directUrl ? { directUrl } : {}),
  },
})
