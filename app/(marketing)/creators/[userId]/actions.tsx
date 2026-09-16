"use server"

import { matureAccess } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

import { CreatorCharacterGrid } from "./CreatorCharacterGrid"

export type RevealCreatorCharactersResult =
  | { status: "ok"; grid: React.ReactNode }
  | { status: "forbidden" }

/**
 * The creator's character grid including mature characters, for a viewer the
 * server has confirmed may see them. The cached page carries the SFW grid;
 * this re-checks `matureAccess` against the user row and never trusts the
 * client's claim.
 */
export async function revealCreatorCharacters(
  creatorId: string
): Promise<RevealCreatorCharactersResult> {
  if (typeof creatorId !== "string" || creatorId.length === 0 || creatorId.length > 64) {
    return { status: "forbidden" }
  }

  const access = matureAccess(await getCurrentUser())
  if (!access.canView) {
    return { status: "forbidden" }
  }

  const characters = await prisma.character.findMany({
    where: { createdById: creatorId, isPublic: true, ...access.visibilityFilter },
    orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
    include: {
      createdBy: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  return { status: "ok", grid: <CreatorCharacterGrid characters={characters} /> }
}
