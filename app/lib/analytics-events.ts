import prisma from "@/app/lib/prismadb"

export type PriorMessageCounter = (userId: string) => Promise<number>

// Default counter: number of NON-AI messages this user has ever sent.
// isAI:false excludes both AI replies and character greeting rows (which are
// stored with isAI:true), so the first real user turn is correctly detected.
const defaultCounter: PriorMessageCounter = (userId) =>
  prisma.message.count({
    where: { senderId: userId, isAI: false },
  })

/**
 * True when this is the user's first-ever human message.
 *
 * Call this AFTER persisting the new message: a count of exactly 1 means the
 * just-saved message is the only one, i.e. it was the first. Fails closed
 * (returns false) on any error so analytics never breaks the request path.
 */
export async function isFirstHumanMessage(
  userId: string,
  counter: PriorMessageCounter = defaultCounter
): Promise<boolean> {
  try {
    const count = await counter(userId)
    return count <= 1
  } catch {
    return false
  }
}
