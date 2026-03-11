import { SignUp } from "@clerk/nextjs"

import { AuthShell, authAppearance } from "@/app/components/auth/AuthShell"

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Create Your Account"
      title="Join the front row while the marketplace is still taking shape."
      description="Start free, chat with creator-built characters, and publish your own once you are ready."
    >
      <SignUp appearance={authAppearance} signInUrl="/sign-in" />
    </AuthShell>
  )
}
