import { SignUp } from "@clerk/nextjs"

import {
  getSafePostAuthPath,
  isClerkClientConfigured,
  isClerkSatellite,
} from "@/app/lib/clerk-auth"
import { isFallbackAuthEnabled } from "@/app/lib/fallback-auth"
import { authAppearance, AuthShell } from "@/app/components/auth/AuthShell"
import { FallbackAuthPanel } from "@/app/components/auth/FallbackAuthPanel"
import { SatelliteAuthRedirect } from "@/app/components/auth/SatelliteAuthRedirect"

interface SignUpPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const redirectPath = getSafePostAuthPath(resolvedSearchParams.redirect_url)
  const fallbackEnabled = isFallbackAuthEnabled()
  const clerkEnabled = isClerkClientConfigured()

  return (
    <AuthShell
      eyebrow="Create Your Account"
      title="Join the front row while the marketplace is still taking shape."
      description="Start free, chat with creator-built characters, and publish your own once you are ready."
    >
      <div className="space-y-6">
        {clerkEnabled ? (
          isClerkSatellite() ? (
            <SatelliteAuthRedirect mode="sign-up" redirectPath={redirectPath} />
          ) : (
            <SignUp appearance={authAppearance} signInUrl="/sign-in" />
          )
        ) : null}

        {fallbackEnabled ? (
          <FallbackAuthPanel mode="sign-up" redirectPath={redirectPath} />
        ) : clerkEnabled ? null : (
          <p className="text-sm text-muted-foreground">
            Sign-up is temporarily unavailable. Enable fallback auth or restore the Clerk keys to
            continue.
          </p>
        )}
      </div>
    </AuthShell>
  )
}
