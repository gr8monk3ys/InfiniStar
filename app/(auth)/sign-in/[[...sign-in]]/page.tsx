import { SignIn } from "@clerk/nextjs"

import { AuthShell, authAppearance } from "@/app/components/auth/AuthShell"

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Welcome Back"
      title="Sign in and pick up where the conversation left off."
      description="Get back to your characters, creator subscriptions, saved memory, and published worlds."
    >
      <SignIn appearance={authAppearance} signUpUrl="/sign-up" />
    </AuthShell>
  )
}
