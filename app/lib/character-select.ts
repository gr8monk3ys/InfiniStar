import type { Prisma } from "@prisma/client"

/**
 * Shared Prisma `select` for public character cards on marketing surfaces
 * (explore, feed). Promoted from the identical constants previously duplicated
 * in app/(marketing)/explore/page.tsx and app/(marketing)/feed/page.tsx.
 */
export const CHARACTER_SELECT = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  avatarUrl: true,
  createdAt: true,
  createdById: true,
  category: true,
  usageCount: true,
  likeCount: true,
  commentCount: true,
  featured: true,
  isNsfw: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
} satisfies Prisma.CharacterSelect
