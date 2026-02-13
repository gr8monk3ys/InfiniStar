/**
 * Template Service
 *
 * Provides functions for managing message templates, including CRUD operations,
 * usage tracking, and template processing with variable substitution.
 */

import { type MessageTemplate, type Prisma } from "@prisma/client"

import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"
import {
  TEMPLATE_CONSTRAINTS,
  TEMPLATE_LIMITS,
  TEMPLATE_SHORTCUT_PATTERN,
  TEMPLATE_VARIABLE_PATTERN,
  type TemplateVariables,
} from "@/app/types"

/**
 * Options for filtering and sorting templates
 */
export interface GetTemplatesOptions {
  category?: string
  sortBy?: "name" | "createdAt" | "updatedAt" | "usageCount"
  sortOrder?: "asc" | "desc"
  limit?: number
  offset?: number
  search?: string
}

/**
 * Data for creating a new template
 */
export interface CreateTemplateData {
  name: string
  content: string
  shortcut?: string | null
  category?: string | null
}

/**
 * Data for updating a template
 */
export interface UpdateTemplateData {
  name?: string
  content?: string
  shortcut?: string | null
  category?: string | null
}

/**
 * Get all templates for a user with optional filtering and sorting
 *
 * @param userId - The user's ID
 * @param options - Filtering and sorting options
 * @returns Array of templates
 */
export async function getUserTemplates(
  userId: string,
  options: GetTemplatesOptions = {}
): Promise<MessageTemplate[]> {
  const { category, sortBy = "name", sortOrder = "asc", limit, offset = 0, search } = options

  const where: Prisma.MessageTemplateWhereInput = {
    userId,
    ...(category && { category }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
        { shortcut: { contains: search, mode: "insensitive" } },
      ],
    }),
  }

  const orderBy: Prisma.MessageTemplateOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  }

  const templates = await prisma.messageTemplate.findMany({
    where,
    orderBy,
    skip: offset,
    ...(limit && { take: limit }),
  })

  return templates
}

/**
 * Get a specific template by ID
 *
 * @param templateId - The template ID
 * @param userId - The user's ID (for authorization)
 * @returns The template or null if not found
 */
export async function getTemplateById(
  templateId: string,
  userId: string
): Promise<MessageTemplate | null> {
  const template = await prisma.messageTemplate.findFirst({
    where: {
      id: templateId,
      userId,
    },
  })

  return template
}

/**
 * Find a template by its shortcut for a specific user
 *
 * @param userId - The user's ID
 * @param shortcut - The shortcut to search for (e.g., "/thanks")
 * @returns The template or null if not found
 */
export async function findTemplateByShortcut(
  userId: string,
  shortcut: string
): Promise<MessageTemplate | null> {
  // Normalize shortcut (ensure it starts with /)
  const normalizedShortcut = shortcut.startsWith("/") ? shortcut : `/${shortcut}`

  const template = await prisma.messageTemplate.findFirst({
    where: {
      userId,
      shortcut: normalizedShortcut,
    },
  })

  return template
}

/**
 * Get the most frequently used templates for a user
 *
 * @param userId - The user's ID
 * @param limit - Maximum number of templates to return (default: 5)
 * @returns Array of popular templates sorted by usage count
 */
export async function getPopularTemplates(
  userId: string,
  limit: number = 5
): Promise<MessageTemplate[]> {
  const templates = await prisma.messageTemplate.findMany({
    where: {
      userId,
      usageCount: { gt: 0 },
    },
    orderBy: {
      usageCount: "desc",
    },
    take: limit,
  })

  return templates
}

/**
 * Get recently used templates for a user
 *
 * @param userId - The user's ID
 * @param limit - Maximum number of templates to return (default: 5)
 * @returns Array of recently used templates
 */
export async function getRecentlyUsedTemplates(
  userId: string,
  limit: number = 5
): Promise<MessageTemplate[]> {
  const templates = await prisma.messageTemplate.findMany({
    where: {
      userId,
      lastUsedAt: { not: null },
    },
    orderBy: {
      lastUsedAt: "desc",
    },
    take: limit,
  })

  return templates
}

/**
 * Create a new template for a user
 *
 * @param userId - The user's ID
 * @param data - Template data
 * @returns The created template
 * @throws Error if validation fails or limit is reached
 */
export async function createTemplate(
  userId: string,
  data: CreateTemplateData
): Promise<MessageTemplate> {
  // Check template limit based on subscription
  const subscription = await getUserSubscriptionPlan(userId)
  const limit = subscription.isPro ? TEMPLATE_LIMITS.PRO : TEMPLATE_LIMITS.FREE

  const currentCount = await prisma.messageTemplate.count({
    where: { userId },
  })

  if (currentCount >= limit) {
    throw new Error(
      `Template limit reached (${limit}). ${
        subscription.isPro ? "Please delete some templates." : "Upgrade to PRO for more templates."
      }`
    )
  }

  // Validate shortcut format if provided
  if (data.shortcut) {
    const normalizedShortcut = data.shortcut.startsWith("/") ? data.shortcut : `/${data.shortcut}`

    if (!TEMPLATE_SHORTCUT_PATTERN.test(normalizedShortcut)) {
      throw new Error(
        'Invalid shortcut format. Must start with "/" and contain only letters, numbers, hyphens, and underscores.'
      )
    }

    // Check if shortcut already exists
    const existingShortcut = await prisma.messageTemplate.findFirst({
      where: {
        userId,
        shortcut: normalizedShortcut,
      },
    })

    if (existingShortcut) {
      throw new Error(`Shortcut "${normalizedShortcut}" is already in use.`)
    }

    data.shortcut = normalizedShortcut
  }

  // Check if name already exists
  const existingName = await prisma.messageTemplate.findFirst({
    where: {
      userId,
      name: data.name,
    },
  })

  if (existingName) {
    throw new Error(`A template named "${data.name}" already exists.`)
  }

  const template = await prisma.messageTemplate.create({
    data: {
      userId,
      name: data.name,
      content: data.content,
      shortcut: data.shortcut || null,
      category: data.category || null,
    },
  })

  return template
}

/**
 * Update an existing template
 *
 * @param templateId - The template ID
 * @param userId - The user's ID (for authorization)
 * @param data - Fields to update
 * @returns The updated template
 * @throws Error if validation fails or template not found
 */
export async function updateTemplate(
  templateId: string,
  userId: string,
  data: UpdateTemplateData
): Promise<MessageTemplate> {
  // Verify template exists and belongs to user
  const existingTemplate = await prisma.messageTemplate.findFirst({
    where: {
      id: templateId,
      userId,
    },
  })

  if (!existingTemplate) {
    throw new Error("Template not found.")
  }

  // Validate shortcut format if provided
  if (data.shortcut !== undefined && data.shortcut !== null) {
    const normalizedShortcut = data.shortcut.startsWith("/") ? data.shortcut : `/${data.shortcut}`

    if (!TEMPLATE_SHORTCUT_PATTERN.test(normalizedShortcut)) {
      throw new Error(
        'Invalid shortcut format. Must start with "/" and contain only letters, numbers, hyphens, and underscores.'
      )
    }

    // Check if shortcut already exists for another template
    const existingShortcut = await prisma.messageTemplate.findFirst({
      where: {
        userId,
        shortcut: normalizedShortcut,
        id: { not: templateId },
      },
    })

    if (existingShortcut) {
      throw new Error(`Shortcut "${normalizedShortcut}" is already in use.`)
    }

    data.shortcut = normalizedShortcut
  }

  // Check if name already exists for another template
  if (data.name !== undefined) {
    const existingName = await prisma.messageTemplate.findFirst({
      where: {
        userId,
        name: data.name,
        id: { not: templateId },
      },
    })

    if (existingName) {
      throw new Error(`A template named "${data.name}" already exists.`)
    }
  }

  const template = await prisma.messageTemplate.update({
    where: { id: templateId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.shortcut !== undefined && { shortcut: data.shortcut }),
      ...(data.category !== undefined && { category: data.category }),
    },
  })

  return template
}

/**
 * Delete a template
 *
 * @param templateId - The template ID
 * @param userId - The user's ID (for authorization)
 * @returns True if deleted successfully
 * @throws Error if template not found
 */
export async function deleteTemplate(templateId: string, userId: string): Promise<boolean> {
  // Verify template exists and belongs to user
  const existingTemplate = await prisma.messageTemplate.findFirst({
    where: {
      id: templateId,
      userId,
    },
  })

  if (!existingTemplate) {
    throw new Error("Template not found.")
  }

  await prisma.messageTemplate.delete({
    where: { id: templateId },
  })

  return true
}

/**
 * Increment usage count and update lastUsedAt for a template
 *
 * @param templateId - The template ID
 * @param userId - The user's ID (for authorization)
 * @returns The updated template
 * @throws Error if template not found
 */
export async function incrementTemplateUsage(
  templateId: string,
  userId: string
): Promise<MessageTemplate> {
  // Verify template exists and belongs to user
  const existingTemplate = await prisma.messageTemplate.findFirst({
    where: {
      id: templateId,
      userId,
    },
  })

  if (!existingTemplate) {
    throw new Error("Template not found.")
  }

  const template = await prisma.messageTemplate.update({
    where: { id: templateId },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  })

  return template
}

/**
 * Process template content by replacing variable placeholders
 *
 * @param content - The template content with {{variable}} placeholders
 * @param variables - Object containing variable values
 * @returns Processed content with variables replaced
 *
 * @example
 * processTemplateVariables(
 *   "Hello {{name}}, today is {{date}}.",
 *   { name: "John", date: "Monday" }
 * )
 * // Returns: "Hello John, today is Monday."
 */
export function processTemplateVariables(
  content: string,
  variables: TemplateVariables = {}
): string {
  // Add default variables
  const defaultVariables: TemplateVariables = {
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    ...variables,
  }

  return content.replace(TEMPLATE_VARIABLE_PATTERN, (match, variableName) => {
    const value = defaultVariables[variableName]
    return value !== undefined ? value : match
  })
}

/**
 * Extract variable names from template content
 *
 * @param content - The template content
 * @returns Array of unique variable names found
 */
export function extractTemplateVariables(content: string): string[] {
  const matches = content.matchAll(TEMPLATE_VARIABLE_PATTERN)
  const variables = new Set<string>()

  for (const match of matches) {
    variables.add(match[1])
  }

  return Array.from(variables)
}

/**
 * Get unique categories used by a user's templates
 *
 * @param userId - The user's ID
 * @returns Array of unique category names
 */
export async function getUserTemplateCategories(userId: string): Promise<string[]> {
  const templates = await prisma.messageTemplate.findMany({
    where: {
      userId,
      category: { not: null },
    },
    select: {
      category: true,
    },
    distinct: ["category"],
  })

  return templates
    .map((t: { category: string | null }) => t.category)
    .filter((c: string | null): c is string => c !== null)
}

/**
 * Get template count for a user
 *
 * @param userId - The user's ID
 * @returns Number of templates the user has
 */
export async function getUserTemplateCount(userId: string): Promise<number> {
  return prisma.messageTemplate.count({
    where: { userId },
  })
}

/**
 * Get template limit info for a user
 *
 * @param userId - The user's ID
 * @returns Object with current count, limit, and whether limit is reached
 */
export async function getTemplateLimitInfo(userId: string): Promise<{
  current: number
  limit: number
  remaining: number
  isLimitReached: boolean
  isPro: boolean
}> {
  const subscription = await getUserSubscriptionPlan(userId)
  const limit = subscription.isPro ? TEMPLATE_LIMITS.PRO : TEMPLATE_LIMITS.FREE
  const current = await getUserTemplateCount(userId)

  return {
    current,
    limit,
    remaining: Math.max(0, limit - current),
    isLimitReached: current >= limit,
    isPro: subscription.isPro,
  }
}

/**
 * Validate template data
 *
 * @param data - Template data to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateTemplateData(data: CreateTemplateData | UpdateTemplateData): {
  isValid: boolean
  error?: string
} {
  // Validate name
  if ("name" in data && data.name !== undefined) {
    if (data.name.length < TEMPLATE_CONSTRAINTS.NAME_MIN_LENGTH) {
      return { isValid: false, error: "Template name is required." }
    }
    if (data.name.length > TEMPLATE_CONSTRAINTS.NAME_MAX_LENGTH) {
      return {
        isValid: false,
        error: `Template name must be ${TEMPLATE_CONSTRAINTS.NAME_MAX_LENGTH} characters or less.`,
      }
    }
  }

  // Validate content
  if ("content" in data && data.content !== undefined) {
    if (data.content.length < TEMPLATE_CONSTRAINTS.CONTENT_MIN_LENGTH) {
      return { isValid: false, error: "Template content is required." }
    }
    if (data.content.length > TEMPLATE_CONSTRAINTS.CONTENT_MAX_LENGTH) {
      return {
        isValid: false,
        error: `Template content must be ${TEMPLATE_CONSTRAINTS.CONTENT_MAX_LENGTH} characters or less.`,
      }
    }
  }

  // Validate shortcut
  if ("shortcut" in data && data.shortcut !== undefined && data.shortcut !== null) {
    if (data.shortcut.length < TEMPLATE_CONSTRAINTS.SHORTCUT_MIN_LENGTH) {
      return {
        isValid: false,
        error: `Shortcut must be at least ${TEMPLATE_CONSTRAINTS.SHORTCUT_MIN_LENGTH} characters.`,
      }
    }
    if (data.shortcut.length > TEMPLATE_CONSTRAINTS.SHORTCUT_MAX_LENGTH) {
      return {
        isValid: false,
        error: `Shortcut must be ${TEMPLATE_CONSTRAINTS.SHORTCUT_MAX_LENGTH} characters or less.`,
      }
    }
    const normalizedShortcut = data.shortcut.startsWith("/") ? data.shortcut : `/${data.shortcut}`
    if (!TEMPLATE_SHORTCUT_PATTERN.test(normalizedShortcut)) {
      return {
        isValid: false,
        error:
          'Invalid shortcut format. Must start with "/" and contain only letters, numbers, hyphens, and underscores.',
      }
    }
  }

  // Validate category
  if ("category" in data && data.category !== undefined && data.category !== null) {
    if (data.category.length > TEMPLATE_CONSTRAINTS.CATEGORY_MAX_LENGTH) {
      return {
        isValid: false,
        error: `Category must be ${TEMPLATE_CONSTRAINTS.CATEGORY_MAX_LENGTH} characters or less.`,
      }
    }
  }

  return { isValid: true }
}
