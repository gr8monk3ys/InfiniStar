"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import { HiArrowPath } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { EmptySection } from "@/app/components/EmptySection"

type AuthMode = "sign-in" | "sign-up"

/**
 * How long the hosted form gets to mount before we stop pretending it is on its
 * way. Long enough to survive a slow phone on a bad connection, short enough
 * that nobody sits in front of a skeleton wondering.
 */
const MOUNT_TIMEOUT_MS = 9000

/** Re-check on a timer as well as on mutations, in case a paint lands without one. */
const POLL_INTERVAL_MS = 250

/**
 * Markers the hosted account form leaves on its own root once it has actually
 * painted. Presence of the node is not enough — an empty root is the failure we
 * are trying to catch — so callers also require it to have children.
 */
const MOUNTED_FORM_SELECTOR = ".cl-rootBox, .cl-card, [data-clerk-component]"

const SUPPORT_EMAIL = "support@infinistar.app"

function formNoun(mode: AuthMode) {
  return mode === "sign-in" ? "sign-in" : "sign-up"
}

function SupportEmailLink() {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      className="font-medium text-primary-accent underline underline-offset-4 hover:text-primary-accent/80"
    >
      {SUPPORT_EMAIL}
    </a>
  )
}

/**
 * Same shape and rhythm as the mounted form: two provider buttons, a divider,
 * two labelled fields and the submit button. It is decorative, so it is hidden
 * from assistive tech and the live region above it does the talking.
 */
function AuthFormSkeleton() {
  return (
    <div aria-hidden={true} className="animate-pulse space-y-5">
      <div className="space-y-3">
        <div className="h-11 rounded-xl border border-border/60 bg-muted/60" />
        <div className="h-11 rounded-xl border border-border/60 bg-muted/60" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <div className="h-2 w-8 rounded-full bg-muted" />
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-11 rounded-xl border border-border/60 bg-muted/40" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className="h-11 rounded-xl border border-border/60 bg-muted/40" />
      </div>
      <div className="h-11 rounded-xl bg-muted" />
    </div>
  )
}

/**
 * The form is served by a third-party script, so the only retry that can change
 * the outcome is a fresh page load — `router.refresh()` (what the shared
 * RetryButton does) re-runs the server render and leaves the failed script
 * exactly where it was. Same label, icon and button shape as RetryButton so the
 * control still reads as the one the rest of the app uses.
 */
function ReloadButton() {
  const [isReloading, setIsReloading] = useState(false)

  return (
    <button
      type="button"
      disabled={isReloading}
      onClick={() => {
        setIsReloading(true)
        window.location.reload()
      }}
      className={cn(buttonVariants({ size: "sm" }), "gap-2")}
    >
      <HiArrowPath className={cn("size-4", isReloading && "animate-spin")} aria-hidden={true} />
      {isReloading ? "Retrying…" : "Try again"}
    </button>
  )
}

function AuthFormErrorActions() {
  return (
    <>
      <ReloadButton />
      <Link href="/explore" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        Browse characters
      </Link>
    </>
  )
}

interface AuthFormUnavailableProps {
  mode: AuthMode
}

/**
 * For the case where there is no hosted form to wait for at all. Says the same
 * thing to the visitor as a mount failure does, because from where they are
 * sitting it is the same thing.
 */
export function AuthFormUnavailable({ mode }: AuthFormUnavailableProps) {
  return (
    <EmptySection
      variant="error"
      className="rounded-2xl"
      title={
        mode === "sign-in" ? "Sign-in is unavailable right now" : "Sign-up is unavailable right now"
      }
      description={
        <>
          We can&rsquo;t open an account session on this request. That is a fault on our side, not
          anything you did, so there is nothing here for you to fix. Try again in a moment, or email{" "}
          <SupportEmailLink /> if it keeps happening.
        </>
      }
      action={<AuthFormErrorActions />}
    />
  )
}

interface AuthFormBoundaryProps {
  mode: AuthMode
  children: React.ReactNode
}

/**
 * Wraps the hosted account form so the card is never an empty rectangle.
 *
 * Readiness is the conjunction of two signals: the official `useAuth().isLoaded`
 * (the account script reached the browser and initialised) and the form having
 * actually painted inside this container. The hook alone can report loaded while
 * the widget renders nothing; the DOM alone can be fooled by an empty root. If
 * neither has happened by MOUNT_TIMEOUT_MS the skeleton is replaced by a real
 * error state rather than left spinning forever.
 */
export function AuthFormBoundary({ mode, children }: AuthFormBoundaryProps) {
  const { isLoaded } = useAuth()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")

  const noun = formNoun(mode)

  const hasPaintedForm = useCallback(() => {
    const container = containerRef.current
    if (!container) return false

    const root = container.querySelector(MOUNTED_FORM_SELECTOR)
    return Boolean(root && root.childElementCount > 0)
  }, [])

  useEffect(() => {
    if (status === "ready") return

    let settled = false
    const disposers: Array<() => void> = []

    const cleanup = () => {
      while (disposers.length) {
        disposers.pop()?.()
      }
    }

    const check = () => {
      if (settled) return
      if (!isLoaded || !hasPaintedForm()) return

      settled = true
      cleanup()
      setStatus("ready")
    }

    const container = containerRef.current
    if (container) {
      const observer = new MutationObserver(check)
      observer.observe(container, { childList: true, subtree: true })
      disposers.push(() => observer.disconnect())
    }

    const pollId = window.setInterval(check, POLL_INTERVAL_MS)
    disposers.push(() => window.clearInterval(pollId))

    // Only the first pass is on a deadline. Once we have shown the error we keep
    // watching, so a form that arrives late still replaces it.
    if (status === "loading") {
      const timeoutId = window.setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        setStatus("failed")
      }, MOUNT_TIMEOUT_MS)
      disposers.push(() => window.clearTimeout(timeoutId))
    }

    check()

    return cleanup
  }, [hasPaintedForm, isLoaded, status])

  return (
    <div aria-busy={status === "loading"}>
      <p aria-live="polite" className="sr-only">
        {status === "loading" ? `Loading the ${noun} form.` : null}
        {status === "ready" ? `The ${noun} form is ready.` : null}
      </p>

      <div ref={containerRef} className={status === "failed" ? "hidden" : undefined}>
        {children}
      </div>

      {status === "loading" ? <AuthFormSkeleton /> : null}

      {status === "failed" ? (
        <EmptySection
          variant="error"
          className="rounded-2xl"
          title={
            mode === "sign-in"
              ? "We couldn't load the sign-in form"
              : "We couldn't load the sign-up form"
          }
          description={
            <>
              The secure form didn&rsquo;t finish loading on this request. That is usually a fault
              on our side or a browser extension blocking it, not anything you did. Try again in a
              moment, or email <SupportEmailLink /> and we will get you in.
            </>
          }
          action={<AuthFormErrorActions />}
        />
      ) : null}
    </div>
  )
}

export default AuthFormBoundary
