"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { NsfwGateCard } from "@/app/components/safety/NsfwGateCard"
import { useAppAuth } from "@/app/hooks/useAppAuth"

import { revealMatureCharacter } from "./actions"

type RevealState =
  | { status: "gated" }
  | { status: "loading" }
  | { status: "revealed"; body: React.ReactNode }

/**
 * The 18+ gate, and the only path through it.
 *
 * This is all the cached document holds for a mature character. The body is
 * requested only after `/api/auth/session` has confirmed `canViewMature` —
 * the cookie hint says "signed in", never "adult, opted in", so it cannot open
 * this — and the server action re-checks the preference before answering.
 *
 * A viewer who enables NSFW from the card lands here too: `NsfwGateCard`
 * refreshes the session, `viewer.canViewMature` flips, and the body loads
 * without a navigation. A denial (a stale session, a preference turned off
 * elsewhere) leaves the gate up, which is what it showed already.
 */
export function MatureCharacterGate({ slug }: { slug: string }) {
  const { isLoaded, isSignedInHint, viewer } = useAppAuth()
  const [reveal, setReveal] = useState<RevealState>({ status: "gated" })

  const canView = isLoaded && viewer.canViewMature

  useEffect(() => {
    if (!canView) {
      return
    }

    let cancelled = false
    setReveal({ status: "loading" })

    revealMatureCharacter(slug)
      .then((result) => {
        if (cancelled) return
        setReveal(
          result.status === "ok" ? { status: "revealed", body: result.body } : { status: "gated" }
        )
      })
      .catch(() => {
        if (!cancelled) setReveal({ status: "gated" })
      })

    return () => {
      cancelled = true
    }
  }, [canView, slug])

  if (reveal.status === "revealed") {
    return <>{reveal.body}</>
  }

  return (
    <section className="container py-12 md:py-16" data-testid="mature-character-gate">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold">NSFW content</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This character is marked as 18+. To view it, you must confirm you are 18+ and enable NSFW
          content in your Safety settings.
        </p>
        <div className="mt-6 flex flex-wrap gap-3" aria-busy={reveal.status === "loading"}>
          <NsfwGateCard />
          <Link
            href={isSignedInHint ? "/dashboard/profile" : "/sign-in"}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {isSignedInHint ? "Open Safety Settings" : "Sign In"}
          </Link>
          <Link href="/explore" className="rounded-md px-4 py-2 text-sm hover:underline">
            Back to Explore
          </Link>
        </div>
        {reveal.status === "loading" && (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            Unlocking…
          </p>
        )}
      </div>
    </section>
  )
}
