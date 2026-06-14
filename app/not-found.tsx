import Link from "next/link"
import { HiOutlineChatBubbleLeftRight, HiOutlineHome } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="relative flex flex-col items-center gap-6">
        {/* 404 number */}
        <p className="text-8xl font-bold tracking-tighter text-primary/20 sm:text-9xl">404</p>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Page not found
          </h1>
          <p className="max-w-md text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard/conversations"
            className={cn(buttonVariants({ variant: "gradient", size: "lg" }), "gap-2")}
          >
            <HiOutlineChatBubbleLeftRight className="size-5" />
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2")}
          >
            <HiOutlineHome className="size-5" />
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
