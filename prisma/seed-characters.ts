// The prisma CLI loads .env through prisma.config.ts; this script is run
// directly by `bun run seed:characters` and gets no such treatment, so it
// loaded nothing and failed on a missing DATABASE_URL even with .env present.
import "dotenv/config"

import { existsSync } from "node:fs"
import { join } from "node:path"
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
  email: "characters@lscaturchio.xyz",
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
    // `avatarUrl` points at a committed file. Seeding a path that does not
    // exist would put a broken image on every card for that character and the
    // seed would report success, so this is checked before anything is written.
    const portrait = join(process.cwd(), "public", character.avatarUrl.replace(/^\//, ""))
    if (!existsSync(portrait)) {
      throw new Error(
        `Missing portrait for "${character.slug}" at ${character.avatarUrl}. ` +
          `Run: node scripts/generate-character-portraits.mjs`
      )
    }
  }

  // Portraits are served by the *deployment*, not by this checkout, and the
  // two move independently: the seed writes to the live database immediately
  // while the files only arrive with the next build. Seeding first is what
  // actually happened — the database gained eighteen `avatarUrl`s pointing at
  // files no deployed build carried, and every card on /explore rendered its
  // alt text on an empty tile until the URLs were cleared.
  //
  // So the URL is only written if the target origin already serves it. When it
  // does not, the characters are seeded with no portrait and fall back to the
  // slug-derived treatment, which is never broken — then re-running after the
  // deploy fills them in. Set `SEED_SKIP_PORTRAIT_PROBE=1` for an air-gapped
  // database with no public origin.
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  let portraitsAreServed = true

  if (origin && process.env.SEED_SKIP_PORTRAIT_PROBE !== "1") {
    const probe = `${origin}${STARTER_CHARACTERS[0].avatarUrl}`
    try {
      const res = await fetch(probe, { method: "GET" })
      const type = res.headers.get("content-type") ?? ""
      portraitsAreServed = res.ok && type.startsWith("image/")
      if (!portraitsAreServed) {
        // A Next.js catch-all answers 200 with text/html for a missing static
        // file, so the status alone proves nothing — the content type does.
        console.warn(
          `⚠️  ${origin} does not serve portraits yet (${res.status} ${type || "no content-type"}).\n` +
            `   Seeding without them; characters will use the generated fallback.\n` +
            `   Re-run this seed after the next deploy to attach the artwork.`
        )
      }
    } catch (error) {
      portraitsAreServed = false
      console.warn(
        `⚠️  Could not reach ${origin} to check portraits (${
          error instanceof Error ? error.message : String(error)
        }). Seeding without them.`
      )
    }
  }

  // Keyed on `clerkId`, not `email`, because the clerk id is the house
  // account's identity and the address is an attribute of it. Upserting by
  // email made the seed non-idempotent the moment the address changed: #92
  // moved it off the dead `infinistar.app` domain, so the lookup found
  // nothing, the create ran, and it collided with the existing row on
  // `clerkId` — P2002, every run, with no way to recover but editing the
  // database. The email is now carried in `update`, so renaming it again just
  // works.
  const creator = await prisma.user.upsert({
    where: { clerkId: HOUSE_CREATOR.clerkId },
    update: { email: HOUSE_CREATOR.email, name: HOUSE_CREATOR.name },
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
      avatarUrl: portraitsAreServed ? content.avatarUrl : null,
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
