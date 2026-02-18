/**
 * @jest-environment node
 */

/**
 * API Route Tests: AI Memory
 *
 * Tests GET /api/ai/memory and POST /api/ai/memory
 */

import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { MemoryCategory } from "@prisma/client"

import { canCreateMemory, getMemoryByKey, getUserMemories, saveMemory } from "@/app/lib/ai-memory"
import { verifyCsrfToken } from "@/app/lib/csrf"
import prisma from "@/app/lib/prismadb"
import { memoryLimiter } from "@/app/lib/rate-limit"
import { sanitizePlainText } from "@/app/lib/sanitize"
// ---- Imports (after mocks) ----

import { GET, POST } from "@/app/api/ai/memory/route"

// ---- Mocks ----

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(() => Promise.resolve({ userId: "clerk_123" })),
}))

jest.mock("@/app/lib/prismadb", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock("@/app/lib/csrf", () => ({
  verifyCsrfToken: jest.fn(() => true),
}))

jest.mock("@/app/lib/rate-limit", () => ({
  memoryLimiter: { check: jest.fn(() => true) },
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}))

jest.mock("@/app/lib/sanitize", () => ({
  sanitizePlainText: jest.fn((text: string) => text),
}))

jest.mock("@/app/lib/ai-memory", () => ({
  getUserMemories: jest.fn(),
  canCreateMemory: jest.fn(),
  getMemoryByKey: jest.fn(),
  saveMemory: jest.fn(),
  MAX_MEMORY_CONTENT_LENGTH: 500,
  MEMORY_CATEGORIES: {
    PREFERENCE: {
      label: "Preference",
      description: "User preferences",
      icon: "settings",
      color: "blue",
    },
    FACT: { label: "Fact", description: "Facts about the user", icon: "info", color: "green" },
    CONTEXT: { label: "Context", description: "Project context", icon: "folder", color: "purple" },
    INSTRUCTION: {
      label: "Instruction",
      description: "Standing instructions",
      icon: "clipboard",
      color: "orange",
    },
    RELATIONSHIP: {
      label: "Relationship",
      description: "Relationship info",
      icon: "users",
      color: "pink",
    },
  },
}))

// ---- Helpers ----

function createGetRequest(queryString = ""): NextRequest {
  return new NextRequest(`http://localhost:3000/api/ai/memory${queryString}`, {
    method: "GET",
  })
}

function createPostRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/memory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-token",
      cookie: "csrf-token=test-token",
    },
    body: JSON.stringify(body),
  })
}

const testUser = { id: "user-1" }

const testMemory = {
  id: "memory-1",
  userId: "user-1",
  key: "preferred_language",
  content: "TypeScript",
  category: MemoryCategory.PREFERENCE,
  importance: 3,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ---- Tests ----

beforeEach(() => {
  jest.clearAllMocks()
  ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: "clerk_123" })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(testUser)
  ;(verifyCsrfToken as jest.Mock).mockReturnValue(true)
  ;(memoryLimiter.check as jest.Mock).mockReturnValue(true)
  ;(getUserMemories as jest.Mock).mockResolvedValue([testMemory])
  ;(canCreateMemory as jest.Mock).mockResolvedValue({ allowed: true, current: 1, limit: 50 })
  ;(getMemoryByKey as jest.Mock).mockResolvedValue(null)
  ;(saveMemory as jest.Mock).mockResolvedValue(testMemory)
  ;(sanitizePlainText as jest.Mock).mockImplementation((text: string) => text)
})

describe("GET /api/ai/memory", () => {
  it("returns 401 when not authenticated", async () => {
    ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: null })

    const request = createGetRequest()
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("returns 401 when user is not found in database", async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    const request = createGetRequest()
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("returns 200 with memories list for authenticated user", async () => {
    const request = createGetRequest()
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.memories).toHaveLength(1)
    expect(data.memories[0].key).toBe("preferred_language")
  })

  it("includes capacity information in the response", async () => {
    ;(canCreateMemory as jest.Mock).mockResolvedValue({ allowed: true, current: 5, limit: 50 })

    const request = createGetRequest()
    const response = await GET(request)

    const data = await response.json()
    expect(data.capacity).toBeDefined()
    expect(data.capacity.current).toBe(5)
    expect(data.capacity.limit).toBe(50)
    expect(data.capacity.remaining).toBe(45)
  })

  it("includes memory categories in the response", async () => {
    const request = createGetRequest()
    const response = await GET(request)

    const data = await response.json()
    expect(data.categories).toBeDefined()
    expect(data.categories.PREFERENCE).toBeDefined()
    expect(data.categories.FACT).toBeDefined()
  })

  it("filters by category when category query param is provided", async () => {
    const request = createGetRequest("?category=PREFERENCE")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(getUserMemories).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ category: MemoryCategory.PREFERENCE })
    )
  })

  it("passes includeExpired false by default", async () => {
    const request = createGetRequest()
    await GET(request)

    expect(getUserMemories).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ includeExpired: false })
    )
  })

  it("passes includeExpired true when query param is set", async () => {
    const request = createGetRequest("?includeExpired=true")
    await GET(request)

    expect(getUserMemories).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ includeExpired: true })
    )
  })

  it("returns 400 for an invalid category value", async () => {
    const request = createGetRequest("?category=INVALID_CATEGORY")
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it("returns empty array when user has no memories", async () => {
    ;(getUserMemories as jest.Mock).mockResolvedValue([])

    const request = createGetRequest()
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.memories).toHaveLength(0)
  })

  it("queries database with the clerk user id", async () => {
    const request = createGetRequest()
    await GET(request)

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkId: "clerk_123" },
      })
    )
  })

  it("returns 500 when database throws an error", async () => {
    ;(getUserMemories as jest.Mock).mockRejectedValue(new Error("DB error"))

    const request = createGetRequest()
    const response = await GET(request)

    expect(response.status).toBe(500)
  })
})

describe("POST /api/ai/memory", () => {
  it("returns 429 when rate limit is exceeded", async () => {
    ;(memoryLimiter.check as jest.Mock).mockReturnValue(false)

    const request = createPostRequest({
      key: "test_key",
      content: "Test content",
    })
    const response = await POST(request)

    expect(response.status).toBe(429)
  })

  it("returns 403 when CSRF token is invalid", async () => {
    ;(verifyCsrfToken as jest.Mock).mockReturnValue(false)

    const request = createPostRequest({
      key: "test_key",
      content: "Test content",
    })
    const response = await POST(request)

    expect(response.status).toBe(403)
  })

  it("returns 401 when not authenticated", async () => {
    ;(auth as unknown as jest.Mock).mockResolvedValue({ userId: null })

    const request = createPostRequest({
      key: "test_key",
      content: "Test content",
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it("returns 401 when user is not found in database", async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    const request = createPostRequest({
      key: "test_key",
      content: "Test content",
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it("creates a new memory with valid data", async () => {
    const request = createPostRequest({
      key: "preferred_language",
      content: "TypeScript",
      category: "PREFERENCE",
      importance: 4,
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.memory).toBeDefined()
    expect(data.isUpdate).toBe(false)
    expect(data.message).toContain("created")
  })

  it("calls saveMemory with the correct user id and sanitized content", async () => {
    const request = createPostRequest({
      key: "test_key",
      content: "My content",
    })
    await POST(request)

    expect(saveMemory).toHaveBeenCalledWith("user-1", "test_key", "My content", expect.any(Object))
  })

  it("returns 400 when key is missing", async () => {
    const request = createPostRequest({
      content: "Test content",
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns 400 when content is missing", async () => {
    const request = createPostRequest({
      key: "test_key",
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns 400 when key contains invalid characters", async () => {
    const request = createPostRequest({
      key: "Invalid-Key!",
      content: "Test content",
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns 400 when key is too long", async () => {
    const request = createPostRequest({
      key: "a".repeat(101),
      content: "Test content",
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns 400 when content is too long", async () => {
    const request = createPostRequest({
      key: "test_key",
      content: "x".repeat(501),
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns 400 when capacity is exceeded for a new memory", async () => {
    ;(canCreateMemory as jest.Mock).mockResolvedValue({
      allowed: false,
      current: 50,
      limit: 50,
    })

    const request = createPostRequest({
      key: "new_memory_key",
      content: "Some content",
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("Memory limit reached")
  })

  it("skips capacity check when updating an existing memory", async () => {
    ;(getMemoryByKey as jest.Mock).mockResolvedValue(testMemory)
    ;(canCreateMemory as jest.Mock).mockResolvedValue({
      allowed: false,
      current: 50,
      limit: 50,
    })

    const request = createPostRequest({
      key: "preferred_language",
      content: "JavaScript",
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(canCreateMemory).not.toHaveBeenCalled()

    const data = await response.json()
    expect(data.isUpdate).toBe(true)
    expect(data.message).toContain("updated")
  })

  it("uses FACT as the default category when not specified", async () => {
    const request = createPostRequest({
      key: "test_key",
      content: "Test content",
    })
    await POST(request)

    expect(saveMemory).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ category: MemoryCategory.FACT })
    )
  })

  it("uses 3 as the default importance when not specified", async () => {
    const request = createPostRequest({
      key: "test_key",
      content: "Test content",
    })
    await POST(request)

    expect(saveMemory).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ importance: 3 })
    )
  })

  it("returns 400 when sanitized content is empty", async () => {
    ;(sanitizePlainText as jest.Mock).mockReturnValue("")

    const request = createPostRequest({
      key: "test_key",
      content: "some content",
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("Invalid memory content")
  })

  it("returns 400 when importance is out of range (below 1)", async () => {
    const request = createPostRequest({
      key: "test_key",
      content: "Test content",
      importance: 0,
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("returns 400 when importance is out of range (above 5)", async () => {
    const request = createPostRequest({
      key: "test_key",
      content: "Test content",
      importance: 6,
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it("accepts all valid MemoryCategory values", async () => {
    const categories: MemoryCategory[] = [
      MemoryCategory.PREFERENCE,
      MemoryCategory.FACT,
      MemoryCategory.CONTEXT,
      MemoryCategory.INSTRUCTION,
      MemoryCategory.RELATIONSHIP,
    ]

    for (const category of categories) {
      ;(getMemoryByKey as jest.Mock).mockResolvedValue(null)
      ;(canCreateMemory as jest.Mock).mockResolvedValue({ allowed: true, current: 0, limit: 50 })

      const request = createPostRequest({
        key: "test_key",
        content: "Test content",
        category,
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
    }
  })

  it("returns 500 when saveMemory throws an unexpected error", async () => {
    ;(saveMemory as jest.Mock).mockRejectedValue(new Error("Unexpected DB failure"))

    const request = createPostRequest({
      key: "test_key",
      content: "Test content",
    })
    const response = await POST(request)

    expect(response.status).toBe(500)
  })
})

export {}
