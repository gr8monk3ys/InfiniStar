/**
 * Schema-contract tests against a real Postgres database.
 *
 * These exist because mocked unit tests cannot catch the class of bug where the
 * Prisma schema and the migrated database disagree: the mock answers happily
 * regardless of what columns actually exist. `migrate deploy` on a fresh
 * database used to produce a `characters.example_dialogues` column while the
 * schema declared `exampleDialogues`, so every character read would have failed
 * in production while the unit suite stayed green.
 */
import { createCharacter, createUser, prisma, resetDatabase } from "./helpers"

describe("schema contract (real database)", () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("round-trips every scalar field the Character model declares", async () => {
    const user = await createUser()

    const created = await prisma.character.create({
      data: {
        name: "Nyra",
        slug: "nyra-navigator",
        tagline: "Starship navigator",
        description: "Charts unmapped space.",
        greeting: "Course plotted.",
        scenario: "Aboard the ISV Starwind.",
        exampleDialogues: "{{user}}: Status?\nNyra: All clear.",
        systemPrompt: "You are Nyra.",
        avatarUrl: "https://example.test/a.png",
        coverImageUrl: "https://example.test/c.png",
        tags: ["scifi", "space"],
        isPublic: true,
        featured: true,
        isNsfw: false,
        category: "scifi",
        createdById: user.id,
      },
    })

    const read = await prisma.character.findUniqueOrThrow({ where: { id: created.id } })

    // exampleDialogues is the specific field the migration drift broke.
    expect(read.exampleDialogues).toBe("{{user}}: Status?\nNyra: All clear.")
    expect(read.scenario).toBe("Aboard the ISV Starwind.")
    expect(read.tags).toEqual(["scifi", "space"])
    expect(read.isPublic).toBe(true)
    expect(read.isNsfw).toBe(false)
    expect(read.commentCount).toBe(0)
    expect(read.likeCount).toBe(0)
    expect(read.category).toBe("scifi")
  })

  it("enforces the unique character slug at the database level", async () => {
    const user = await createUser()
    await createCharacter(user.id, { slug: "duplicate-slug" })

    await expect(createCharacter(user.id, { slug: "duplicate-slug" })).rejects.toThrow(
      /Unique constraint/i
    )
  })

  it("enforces one like per user per character", async () => {
    const user = await createUser()
    const character = await createCharacter(user.id)

    await prisma.characterLike.create({ data: { userId: user.id, characterId: character.id } })

    await expect(
      prisma.characterLike.create({ data: { userId: user.id, characterId: character.id } })
    ).rejects.toThrow(/Unique constraint/i)
  })

  it("cascades character and like deletion when the creator is deleted", async () => {
    const user = await createUser()
    const character = await createCharacter(user.id)
    await prisma.characterLike.create({ data: { userId: user.id, characterId: character.id } })

    await prisma.user.delete({ where: { id: user.id } })

    expect(await prisma.character.count({ where: { id: character.id } })).toBe(0)
    expect(await prisma.characterLike.count({ where: { characterId: character.id } })).toBe(0)
  })

  it("nulls conversation.characterId instead of deleting the conversation", async () => {
    const user = await createUser()
    const character = await createCharacter(user.id)
    const conversation = await prisma.conversation.create({
      data: {
        name: "With character",
        isAI: true,
        characterId: character.id,
        users: { connect: { id: user.id } },
      },
    })

    await prisma.character.delete({ where: { id: character.id } })

    const read = await prisma.conversation.findUnique({ where: { id: conversation.id } })
    expect(read).not.toBeNull()
    expect(read?.characterId).toBeNull()
  })

  it("persists the moderation enums the schema declares", async () => {
    const reporter = await createUser()

    const report = await prisma.contentReport.create({
      data: {
        reporterId: reporter.id,
        targetType: "CHARACTER",
        targetId: "some-character-id",
        reason: "HARASSMENT",
        details: "Test report",
      },
    })

    expect(report.status).toBe("OPEN")

    const updated = await prisma.contentReport.update({
      where: { id: report.id },
      data: { status: "RESOLVED" },
    })
    expect(updated.status).toBe("RESOLVED")
  })

  it("enforces one block per blocker/blocked pair", async () => {
    const blocker = await createUser()
    const blocked = await createUser()

    await prisma.userBlock.create({ data: { blockerId: blocker.id, blockedId: blocked.id } })

    await expect(
      prisma.userBlock.create({ data: { blockerId: blocker.id, blockedId: blocked.id } })
    ).rejects.toThrow(/Unique constraint/i)
  })
})
