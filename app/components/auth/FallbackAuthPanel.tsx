"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/app/components/ui/button"
import { useAppAuth } from "@/app/hooks/useAppAuth"
import { useCsrfToken, withCsrfHeader } from "@/app/hooks/useCsrfToken"

interface FallbackAuthPanelProps {
  mode: "sign-in" | "sign-up"
  redirectPath: string
}

export function FallbackAuthPanel({ mode, redirectPath }: FallbackAuthPanelProps) {
  const isSignIn = mode === "sign-in"
  const router = useRouter()
  const { refresh } = useAppAuth()
  const { token } = useCsrfToken()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  function showFormError(message: string) {
    // Inline, next to the fields, instead of a toast: role="alert" announces it.
    setFormError(message)
    // Move focus to the message so keyboard and screen-reader users land on it.
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      showFormError("Security token unavailable. Refresh and try again.")
      return
    }

    setFormError(null)

    // One transition covers the request and the redirect, so the button is
    // disabled (and cannot double-submit) from the first click until we leave.
    startTransition(async () => {
      let response: Response
      try {
        response = await fetch(
          isSignIn ? "/api/auth/fallback/sign-in" : "/api/auth/fallback/sign-up",
          {
            method: "POST",
            credentials: "include",
            headers: withCsrfHeader(token, {
              "Content-Type": "application/json",
            }),
            body: JSON.stringify({
              ...(isSignIn ? {} : { name }),
              email,
              password,
              redirectPath,
            }),
          }
        )
      } catch {
        showFormError("Couldn't reach the server. Check your connection and try again.")
        return
      }

      const payload = (await response.json().catch(() => null)) as {
        error?: string
        redirectPath?: string
      } | null

      if (!response.ok) {
        showFormError(
          payload?.error ||
            "Couldn't continue with backup access. Check your email and password, then try again."
        )
        return
      }

      await refresh()
      router.push(payload?.redirectPath || redirectPath)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Backup Access</h2>
        <p className="text-sm text-muted-foreground">
          Use local email and password auth if the hosted Clerk flow is unavailable.
        </p>
      </div>

      <form
        className="space-y-3"
        onSubmit={handleSubmit}
        aria-describedby={formError ? "fallback-form-error" : undefined}
      >
        {!isSignIn ? (
          <div className="space-y-1.5">
            <label htmlFor="fallback-name" className="text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="fallback-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground shadow-none focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              maxLength={100}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="fallback-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="fallback-email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            aria-invalid={formError ? true : undefined}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground shadow-none focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="fallback-password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="fallback-password"
            name="password"
            type="password"
            aria-invalid={formError ? true : undefined}
            autoComplete={isSignIn ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground shadow-none focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>

        {formError ? (
          <p
            id="fallback-form-error"
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending
            ? "Please wait…"
            : isSignIn
              ? "Continue with Backup Access"
              : "Create Backup Account"}
        </Button>
      </form>

      {!isSignIn ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Existing Clerk accounts cannot claim backup access from this form. Sign in once with the
          hosted flow and change your password in profile settings to seed a local fallback
          password.
        </p>
      ) : null}
    </div>
  )
}
