"use server"

import { matureAccess } from "@/app/lib/nsfw"
import prisma from "@/app/lib/prismadb"
import getCurrentUser from "@/app/actions/getCurrentUser"

import { CharacterPageBody } from "./CharacterPageBody"

export type RevealMatureCharacterResult =
  | { status: "ok"; body: React.ReactNode }
  | { status: "forbidden" }
  | { status: "not-found" }

/**
 * The body of a mature character page, for a viewer the server has confirmed
 * may see it.
 *
 * The page itself is cached and carries only the gate. This is the one
 * request that reads the session, and it is the gate: `matureAccess` is
 * re-checked here against the user row, never trusted from the client. A
 * caller without the preference gets `forbidden` and no data, whatever
 * `/api/auth/session` told the browser.
 */
export async function revealMatureCharacter(slug: string): Promise<RevealMatureCharacterResult> {
  if (typeof slug !== "string" || slug.length === 0 || slug.length > 200) {
    return { status: "not-found" }
  }

  const currentUser = await getCurrentUser()
  const access = matureAccess(currentUser)
  if (!access.canView) {
    return { status: "forbidden" }
  }

  const character = await prisma.character.findUnique({
    where: { slug },
    include: {
      createdBy: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  if (!character || !character.isPublic) {
    return { status: "not-found" }
  }

  return { status: "ok", body: <CharacterPageBody character={character} access={access} /> }
}
