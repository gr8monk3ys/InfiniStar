import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { HiOutlineHeart } from "react-icons/hi2"

import prisma from "@/app/lib/prismadb"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import getCurrentUser from "@/app/actions/getCurrentUser"

import FavoritesGrid from "./FavoritesGrid"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Favorites | InfiniStar",
  description: "Your favorite AI characters",
}

export default async function FavoritesPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect("/sign-in")

  // Select only what the card renders: everything here is serialized into the
  // client payload for FavoritesGrid (the full row would include system prompts).
  const likes = await prisma.characterLike.findMany({
    where: { userId: currentUser.id },
    select: {
      createdAt: true,
      character: {
        select: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          avatarUrl: true,
          category: true,
          usageCount: true,
          likeCount: true,
          commentCount: true,
          isNsfw: true,
          createdBy: {
            select: { id: true, name: true, image: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const characters = likes.map((like) => ({
    ...like.character,
    likedAt: like.createdAt,
  }))

  return (
    <div className="h-full lg:pl-80">
      <div className="flex h-full flex-col p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Favorites</h1>
            <p className="text-sm tabular-nums text-muted-foreground">
              {characters.length} {characters.length === 1 ? "character" : "characters"}
            </p>
          </div>
          <Link href="/explore" className={cn(buttonVariants({ variant: "outline" }))}>
            Discover More
          </Link>
        </div>

        {characters.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-full bg-muted p-6">
              <HiOutlineHeart className="size-12 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">No Favorites Yet</h2>
              <p className="text-sm text-muted-foreground">
                Like characters to save them here for quick access.
              </p>
            </div>
            <Link href="/explore" className={cn(buttonVariants())}>
              Explore Characters
            </Link>
          </div>
        ) : (
          <FavoritesGrid characters={characters} />
        )}
      </div>
    </div>
  )
}
