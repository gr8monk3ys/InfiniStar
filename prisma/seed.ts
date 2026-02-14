import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.warn("🌱 Starting database seed...")

  // Create test users (using Clerk IDs for authentication)
  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      name: "Alice Johnson",
      clerkId: "clerk_test_alice_001",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
    },
  })

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      name: "Bob Smith",
      clerkId: "clerk_test_bob_002",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
    },
  })

  const charlie = await prisma.user.upsert({
    where: { email: "charlie@example.com" },
    update: {},
    create: {
      email: "charlie@example.com",
      name: "Charlie Brown",
      clerkId: "clerk_test_charlie_003",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie",
    },
  })

  console.warn("✅ Created test users")

  // Create 1-on-1 conversation between Alice and Bob
  const conversation1 = await prisma.conversation.create({
    data: {
      users: {
        connect: [{ id: alice.id }, { id: bob.id }],
      },
    },
  })

  // Add some messages to the conversation
  await prisma.message.create({
    data: {
      body: "Hey Bob! How are you?",
      conversationId: conversation1.id,
      senderId: alice.id,
      seen: {
        connect: { id: alice.id },
      },
    },
  })

  await prisma.message.create({
    data: {
      body: "Hi Alice! I'm doing great, thanks! How about you?",
      conversationId: conversation1.id,
      senderId: bob.id,
      seen: {
        connect: [{ id: bob.id }, { id: alice.id }],
      },
    },
  })

  await prisma.message.create({
    data: {
      body: "I'm good! Want to grab coffee later?",
      conversationId: conversation1.id,
      senderId: alice.id,
      seen: {
        connect: { id: alice.id },
      },
    },
  })

  console.warn("✅ Created 1-on-1 conversation with messages")

  // Create group conversation
  const groupConversation = await prisma.conversation.create({
    data: {
      name: "Team Chat",
      isGroup: true,
      users: {
        connect: [{ id: alice.id }, { id: bob.id }, { id: charlie.id }],
      },
    },
  })

  await prisma.message.create({
    data: {
      body: "Welcome to the team chat everyone!",
      conversationId: groupConversation.id,
      senderId: alice.id,
      seen: {
        connect: { id: alice.id },
      },
    },
  })

  await prisma.message.create({
    data: {
      body: "Thanks for setting this up, Alice!",
      conversationId: groupConversation.id,
      senderId: bob.id,
      seen: {
        connect: [{ id: bob.id }, { id: alice.id }],
      },
    },
  })

  await prisma.message.create({
    data: {
      body: "Hey everyone! Glad to be here!",
      conversationId: groupConversation.id,
      senderId: charlie.id,
      seen: {
        connect: [{ id: charlie.id }, { id: alice.id }],
      },
    },
  })

  console.warn("✅ Created group conversation with messages")

  // Create AI conversation for Alice
  const aiConversation = await prisma.conversation.create({
    data: {
      name: "AI Assistant",
      isAI: true,
      aiModel: "claude-sonnet-4-5-20250929",
      users: {
        connect: { id: alice.id },
      },
    },
  })

  await prisma.message.create({
    data: {
      body: "Hello! How can I help you today?",
      conversationId: aiConversation.id,
      senderId: alice.id,
      isAI: true,
      seen: {
        connect: { id: alice.id },
      },
    },
  })

  await prisma.message.create({
    data: {
      body: "What is the meaning of life?",
      conversationId: aiConversation.id,
      senderId: alice.id,
      isAI: false,
      seen: {
        connect: { id: alice.id },
      },
    },
  })

  await prisma.message.create({
    data: {
      body: "The meaning of life is a profound philosophical question that has been pondered for centuries. Different perspectives offer various interpretations - from finding personal fulfillment and happiness, to contributing to society, to spiritual enlightenment. What resonates most with you?",
      conversationId: aiConversation.id,
      senderId: alice.id,
      isAI: true,
      seen: {
        connect: { id: alice.id },
      },
    },
  })

  console.warn("✅ Created AI conversation with sample messages")

  console.warn("\n🎉 Seeding completed successfully!")
  console.warn("\nTest accounts (authenticate via Clerk):")
  console.warn("  📧 alice@example.com (clerkId: clerk_test_alice_001)")
  console.warn("  📧 bob@example.com (clerkId: clerk_test_bob_002)")
  console.warn("  📧 charlie@example.com (clerkId: clerk_test_charlie_003)")
  console.warn("\nYou can now log in with any of these accounts via Clerk.")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("❌ Seeding failed:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
