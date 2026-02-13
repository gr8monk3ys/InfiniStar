"use client"

import { useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"

import { api, ApiError } from "@/app/lib/api-client"
import { navigateTo } from "@/app/lib/navigation"
import { cn } from "@/app/lib/utils"
import { Button, buttonVariants } from "@/app/components/ui/button"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

interface PricingCtaButtonProps {
  isSignedIn: boolean
  isPro: boolean
  className?: string
}

export function PricingCtaButton({ isSignedIn, isPro, className }: PricingCtaButtonProps) {
  const { token: csrfToken, loading: csrfLoading } = useCsrfToken()
  const [isLoading, setIsLoading] = useState(false)

  if (!isSignedIn) {
    return (
      <Link href="/sign-in" className={cn(buttonVariants({ size: "lg" }), className)}>
        Upgrade to PRO
      </Link>
    )
  }

  const redirectToStripeUrl = async (endpoint: "/api/stripe/checkout" | "/api/stripe/portal") => {
    if (!csrfToken) {
      toast.error("Unable to load security token. Please refresh and try again.")
      return
    }

    setIsLoading(true)

    try {
      const response = await api.post<{ url: string }>(
        endpoint,
        {},
        {
          headers: {
            "X-CSRF-Token": csrfToken,
          },
          retries: 1,
        }
      )

      navigateTo(response.url)
    } catch (error) {
      if (
        endpoint === "/api/stripe/checkout" &&
        error instanceof ApiError &&
        error.message.toLowerCase().includes("already has an active subscription")
      ) {
        try {
          const portalResponse = await api.post<{ url: string }>(
            "/api/stripe/portal",
            {},
            {
              headers: {
                "X-CSRF-Token": csrfToken,
              },
              retries: 1,
            }
          )
          navigateTo(portalResponse.url)
          return
        } catch {
          toast.error("Unable to open billing portal. Please try again.")
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClick = async () => {
    if (isPro) {
      await redirectToStripeUrl("/api/stripe/portal")
      return
    }

    await redirectToStripeUrl("/api/stripe/checkout")
  }

  return (
    <Button
      type="button"
      size="lg"
      onClick={handleClick}
      disabled={csrfLoading || isLoading}
      className={className}
    >
      {isLoading ? "Redirecting..." : isPro ? "Manage Billing" : "Upgrade to PRO"}
    </Button>
  )
}
