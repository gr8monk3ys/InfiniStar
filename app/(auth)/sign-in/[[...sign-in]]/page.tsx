import { SignIn } from "@clerk/nextjs"

import {
  getSafePostAuthPath,
  isClerkClientConfigured,
  isClerkSatellite,
} from "@/app/lib/clerk-auth"
import { isFallbackAuthEnabled } from "@/app/lib/fallback-auth"
import prisma from "@/app/lib/prismadb"
import { AuthFormBoundary, AuthFormUnavailable } from "@/app/components/auth/AuthFormBoundary"
import { authAppearance, AuthShell } from "@/app/components/auth/AuthShell"
import { FallbackAuthPanel } from "@/app/components/auth/FallbackAuthPanel"
import { SatelliteAuthRedirect } from "@/app/components/auth/SatelliteAuthRedirect"

interface SignInPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const CHARACTER_PATH_PATTERN = /^\/characters\/([a-z0-9-]+)(?:[/?#]|$)/i

/**
 * When the visitor was bounced here from a character page, name the character
 * so the form reads as a step in their flow, not a wall. One indexed lookup;
 * any failure degrades to the generic line.
 */
async function getCardEyebrow(redirectPath: string) {
  const slug = CHARACTER_PATH_PATTERN.exec(redirectPath)?.[1]
  if (!slug) return undefined

  try {
    const character = await prisma.character.findUnique({
      where: { slug },
      select: { name: true, isPublic: true },
    })
    if (character?.isPublic) {
      return `Sign in to talk to ${character.name}`
    }
  } catch {
    // Fall through to the generic label.
  }

  return "Sign in to keep chatting"
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const redirectPath = getSafePostAuthPath(resolvedSearchParams.redirect_url)
  const fallbackEnabled = isFallbackAuthEnabled()
  const clerkEnabled = isClerkClientConfigured()
  const cardEyebrow = await getCardEyebrow(redirectPath)

  return (
    <AuthShell
      title="Sign in and pick up where the conversation left off."
      description="Get back to your characters, creator subscriptions, saved memory, and published worlds."
      cardEyebrow={cardEyebrow}
    >
      <div className="space-y-6">
        {clerkEnabled ? (
          isClerkSatellite() ? (
            <SatelliteAuthRedirect mode="sign-in" redirectPath={redirectPath} />
          ) : (
            <AuthFormBoundary mode="sign-in">
              <SignIn appearance={authAppearance} signUpUrl="/sign-up" />
            </AuthFormBoundary>
          )
        ) : null}

        {fallbackEnabled ? (
          <FallbackAuthPanel mode="sign-in" redirectPath={redirectPath} />
        ) : clerkEnabled ? null : (
          <AuthFormUnavailable mode="sign-in" />
        )}
      </div>
    </AuthShell>
  )
}
