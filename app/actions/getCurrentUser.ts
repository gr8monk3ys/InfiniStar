import { getAuthSession } from "@/app/lib/auth"
import prisma from "@/app/lib/prismadb"

const slimSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  clerkId: true,
  stripePriceId: true,
  stripeCurrentPeriodEnd: true,
  isAdult: true,
  nsfwEnabled: true,
  adultConfirmedAt: true,
} as const

export type SlimUser = NonNullable<Awaited<ReturnType<typeof getCurrentUserSlim>>>

export async function getCurrentUserSlim() {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return null
    }

    return prisma.user.findUnique({
      where: { id: session.user.id },
      select: slimSelect,
    })
  } catch {
    return null
  }
}

const getCurrentUser = async () => {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return null
    }

    return prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      // Never hand the password hash to API routes — callers that legitimately
      // need it (fallback sign-in, backup-password changes) query it directly.
      omit: {
        hashedPassword: true,
      },
    })
  } catch {
    return null
  }
}

export default getCurrentUser
