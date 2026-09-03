// The prisma CLI loads .env through prisma.config.ts; this script is run
// directly by `bun run seed:characters` and gets no such treatment, so it
// loaded nothing and failed on a missing DATABASE_URL even with .env present.
import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

import { getCategoryById } from "../app/lib/character-categories"
import { STARTER_CHARACTERS } from "./starter-characters"

// Production starter-content seed.
//
// A fresh database has zero public characters, which leaves /explore empty and
// gives brand-new users nothing to chat with. This script creates one "house"
// creator account and a set of quality public starter characters.
//
// Idempotent and safe to run on production: the creator is upserted by email
// and every character is upserted by slug. Re-running refreshes the starter
// characters' authored content (name, prompts, tags, flags) without touching
// engagement counters (views, likes, usage) or any user-created data.

// Prisma 7 with driver adapters requires an explicit adapter — a bare
// `new PrismaClient()` throws at construction time.
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL must be set to run the seed script")
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const HOUSE_CREATOR = {
  email: "characters@infinistar.app",
  clerkId: "infinistar_house_characters",
  name: "InfiniStar",
} as const

async function main(): Promise<void> {
  console.warn("🌱 Seeding production starter characters...")

  // Guard against typos: every category must exist in app/lib/character-categories.ts
  for (const character of STARTER_CHARACTERS) {
    if (!getCategoryById(character.category)) {
      throw new Error(`Invalid category "${character.category}" on character "${character.slug}"`)
    }
  }

  const creator = await prisma.user.upsert({
    where: { email: HOUSE_CREATOR.email },
    update: {},
    create: {
      email: HOUSE_CREATOR.email,
      clerkId: HOUSE_CREATOR.clerkId,
      name: HOUSE_CREATOR.name,
    },
  })

  console.warn(`✅ House creator ready: ${HOUSE_CREATOR.email}`)

  for (const character of STARTER_CHARACTERS) {
    const { slug, ...content } = character
    const data = {
      ...content,
      isNsfw: false,
    }

    const record = await prisma.character.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data, createdById: creator.id },
    })

    console.warn(
      `${record.isPublic ? "✅ published" : "◦  private "}  ${record.name} (${record.slug}) [${
        record.category
      }]${record.featured ? " ★ featured" : ""}`
    )
  }

  const publishedCount = STARTER_CHARACTERS.filter((c) => c.isPublic).length
  console.warn(
    `\n🎉 Seed complete: ${publishedCount} published, ${
      STARTER_CHARACTERS.length - publishedCount
    } kept private.`
  )
  console.warn("Safe to re-run at any time — existing characters are updated in place.")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("❌ Starter character seed failed:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
