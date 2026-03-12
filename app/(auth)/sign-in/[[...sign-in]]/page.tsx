import { SignIn } from "@clerk/nextjs"

import {
  getSafePostAuthPath,
  isClerkClientConfigured,
  isClerkSatellite,
} from "@/app/lib/clerk-auth"
import { isFallbackAuthEnabled } from "@/app/lib/fallback-auth"
import { authAppearance, AuthShell } from "@/app/components/auth/AuthShell"
import { FallbackAuthPanel } from "@/app/components/auth/FallbackAuthPanel"
import { SatelliteAuthRedirect } from "@/app/components/auth/SatelliteAuthRedirect"

interface SignInPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const redirectPath = getSafePostAuthPath(resolvedSearchParams.redirect_url)
  const fallbackEnabled = isFallbackAuthEnabled()
  const clerkEnabled = isClerkClientConfigured()

  return (
    <AuthShell
      eyebrow="Welcome Back"
      title="Sign in and pick up where the conversation left off."
      description="Get back to your characters, creator subscriptions, saved memory, and published worlds."
    >
      <div className="space-y-6">
        {clerkEnabled ? (
          isClerkSatellite() ? (
            <SatelliteAuthRedirect mode="sign-in" redirectPath={redirectPath} />
          ) : (
            <SignIn appearance={authAppearance} signUpUrl="/sign-up" />
          )
        ) : null}

        {fallbackEnabled ? (
          <FallbackAuthPanel mode="sign-in" redirectPath={redirectPath} />
        ) : clerkEnabled ? null : (
          <p className="text-sm text-muted-foreground">
            Sign-in is temporarily unavailable. Enable fallback auth or restore the Clerk keys to
            continue.
          </p>
        )}
      </div>
    </AuthShell>
  )
}
