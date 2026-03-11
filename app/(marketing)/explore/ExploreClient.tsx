"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import {
  HiMagnifyingGlass,
  HiOutlineFire,
  HiOutlineRocketLaunch,
  HiOutlineSparkles,
  HiOutlineUsers,
} from "react-icons/hi2"

import { CHARACTER_CATEGORIES } from "@/app/lib/character-categories"
import { cn } from "@/app/lib/utils"
import { buttonVariants } from "@/app/components/ui/button"
import { CharacterCard } from "@/app/components/characters/CharacterCard"
import { useCsrfToken, withCsrfHeader } from "@/app/hooks/useCsrfToken"

interface CharacterData {
  id: string
  slug: string
  name: string
  tagline?: string | null
  avatarUrl?: string | null
  category: string
  usageCount: number
  likeCount: number
  commentCount: number
  createdBy?: {
    id: string
    name: string | null
    image: string | null
  } | null
}

interface ExploreClientProps {
  featured: CharacterData[]
  trending: CharacterData[]
  all: CharacterData[]
  likedIds: string[]
}

const TABS = [{ id: "all", name: "All" }, ...CHARACTER_CATEGORIES.filter((c) => c.id !== "general")]

const STARTER_ARCHETYPES = [
  {
    label: "Companion",
    title: "Late-night confidant",
    description:
      "A warm, emotionally present character for check-ins, flirting, and longer personal chats.",
  },
  {
    label: "Roleplay",
    title: "Questline architect",
    description:
      "A worldbuilding partner who can keep the lore straight while moving the scene forward.",
  },
  {
    label: "Tutor",
    title: "Sharp study coach",
    description:
      "A helper with enough backbone to challenge your thinking instead of praising every draft.",
  },
]

export default function ExploreClient({
  featured,
  trending,
  all,
  likedIds: initialLikedIds,
}: ExploreClientProps) {
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [likedIds, setLikedIds] = useState<string[]>(initialLikedIds)
  const { token } = useCsrfToken()
  const hasAnyCharacters = featured.length > 0 || trending.length > 0 || all.length > 0

  const filteredAll = useMemo(() => {
    let items = all
    if (activeCategory !== "all") {
      items = items.filter((c) => c.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (c) => c.name.toLowerCase().includes(q) || c.tagline?.toLowerCase().includes(q)
      )
    }
    return items
  }, [all, activeCategory, searchQuery])

  const filteredTrending = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return trending.filter(
        (c) => c.name.toLowerCase().includes(q) || c.tagline?.toLowerCase().includes(q)
      )
    }
    return trending
  }, [trending, searchQuery])

  const filteredFeatured = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return featured.filter(
        (c) => c.name.toLowerCase().includes(q) || c.tagline?.toLowerCase().includes(q)
      )
    }
    return featured
  }, [featured, searchQuery])

  const handleLike = useCallback(
    async (characterId: string) => {
      setLikedIds((prev) => [...prev, characterId])
      try {
        const res = await fetch(`/api/characters/${characterId}/like`, {
          method: "POST",
          headers: withCsrfHeader(token, {
            "Content-Type": "application/json",
          }),
        })
        if (!res.ok) {
          setLikedIds((prev) => prev.filter((id) => id !== characterId))
          const data = await res.json()
          toast.error(data.error || "Failed to like character")
        }
      } catch {
        setLikedIds((prev) => prev.filter((id) => id !== characterId))
        toast.error("Failed to like character")
      }
    },
    [token]
  )

  const handleUnlike = useCallback(
    async (characterId: string) => {
      setLikedIds((prev) => prev.filter((id) => id !== characterId))
      try {
        const res = await fetch(`/api/characters/${characterId}/like`, {
          method: "DELETE",
          headers: withCsrfHeader(token, {
            "Content-Type": "application/json",
          }),
        })
        if (!res.ok) {
          setLikedIds((prev) => [...prev, characterId])
          const data = await res.json()
          toast.error(data.error || "Failed to unlike character")
        }
      } catch {
        setLikedIds((prev) => [...prev, characterId])
        toast.error("Failed to unlike character")
      }
    },
    [token]
  )

  if (!hasAnyCharacters) {
    return (
      <div className="flex flex-col gap-10">
        <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-primary/5 via-background to-sky-500/5 px-6 py-16 md:px-12 md:py-24">
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary">
              <HiOutlineSparkles className="size-4" />
              Launch edition marketplace
            </div>
            <h1 className="font-heading mt-6 text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl">
              The public catalog is opening up now
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              There are no public characters live yet, so the best UX move is to make that feel
              intentional: publish early, shape the front page, and set the tone for the community.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard/characters/new" className={cn(buttonVariants({ size: "lg" }))}>
                <HiOutlineRocketLaunch className="mr-2 size-5" />
                Create the first character
              </Link>
              <Link
                href="/feed"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2")}
              >
                <HiOutlineUsers className="size-5" />
                Visit Creator Feed
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-center gap-2">
            <HiOutlineSparkles className="size-5 text-primary" />
            <h2 className="text-xl font-bold">Good first lanes to build</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STARTER_ARCHETYPES.map((archetype) => (
              <article
                key={archetype.title}
                className="rounded-3xl border border-border/50 bg-card/70 p-6 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                  {archetype.label}
                </p>
                <h3 className="mt-4 text-xl font-semibold">{archetype.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {archetype.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border/50 bg-muted/30 px-6 py-12 text-center md:px-12">
          <h2 className="text-2xl font-bold md:text-3xl">Why publish early?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Early creators do not just add inventory. They define what this place feels like when
            new users arrive.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/50 bg-background/80 p-5">
              <p className="text-sm font-semibold text-foreground">Own the first impression</p>
              <p className="mt-2 text-sm text-muted-foreground">
                New visitors remember the first memorable character more than any marketing copy.
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/80 p-5">
              <p className="text-sm font-semibold text-foreground">Set a quality bar</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Strong public examples teach later creators what “good” looks like on the platform.
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/80 p-5">
              <p className="text-sm font-semibold text-foreground">Build your creator profile early</p>
              <p className="mt-2 text-sm text-muted-foreground">
                You get more room to establish your tone before the marketplace gets crowded.
              </p>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 px-6 py-16 text-center md:px-12 md:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="font-heading text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl">
            Discover AI Characters
          </h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Browse creator-made characters across roleplay, fandom, companionship, tutoring, and
            stranger niches that feel authored instead of generic.
          </p>

          {/* Search Bar */}
          <div className="relative mx-auto mt-8 max-w-xl">
            <HiMagnifyingGlass className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search characters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full rounded-full border bg-background py-3 pl-12 pr-4",
                "text-sm shadow-sm transition-shadow",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/50"
              )}
              aria-label="Search characters"
            />
          </div>
        </div>
      </section>

      {/* Category Tabs */}
      <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Character categories">
        <div className="flex gap-2 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium",
                "transition-colors",
                activeCategory === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              aria-pressed={activeCategory === tab.id}
            >
              {"emoji" in tab && tab.emoji ? `${tab.emoji} ${tab.name}` : tab.name}
            </button>
          ))}
        </div>
      </nav>

      {/* Featured Section */}
      {filteredFeatured.length > 0 && (
        <section>
          <div className="mb-6 flex items-center gap-2">
            <HiOutlineSparkles className="size-5 text-yellow-500" />
            <h2 className="text-xl font-bold">Featured</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFeatured.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                isLiked={likedIds.includes(character.id)}
                onLike={handleLike}
                onUnlike={handleUnlike}
              />
            ))}
          </div>
        </section>
      )}

      {/* Trending Section */}
      {filteredTrending.length > 0 && (
        <section>
          <div className="mb-6 flex items-center gap-2">
            <HiOutlineFire className="size-5 text-orange-500" />
            <h2 className="text-xl font-bold">Trending Characters</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredTrending.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                isLiked={likedIds.includes(character.id)}
                onLike={handleLike}
                onUnlike={handleUnlike}
              />
            ))}
          </div>
        </section>
      )}

      {/* All Characters */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {activeCategory === "all"
              ? "All Characters"
              : (TABS.find((t) => t.id === activeCategory)?.name ?? "Characters")}
          </h2>
          <span className="text-sm text-muted-foreground">
            {filteredAll.length} character
            {filteredAll.length !== 1 ? "s" : ""}
          </span>
        </div>

        {filteredAll.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
            <h3 className="text-lg font-semibold">Nothing matched this cut</h3>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
              No characters found
              {searchQuery ? ` matching "${searchQuery}"` : " in this category"}. Try widening the
              search, or clear the filters and browse what is already getting traction.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => {
                  setSearchQuery("")
                  setActiveCategory("all")
                }}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Clear filters
              </button>
              <Link href="/feed" className={cn(buttonVariants({ variant: "ghost" }))}>
                Visit creator feed
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredAll.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                isLiked={likedIds.includes(character.id)}
                onLike={handleLike}
                onUnlike={handleUnlike}
              />
            ))}
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 px-6 py-12 text-center md:px-12 md:py-16">
        <h2 className="text-2xl font-bold md:text-3xl">Create Your Own Character</h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Design a unique AI personality with custom instructions, a backstory, and greeting
          message. Share it with the community.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link href="/dashboard/characters/new" className={cn(buttonVariants({ size: "lg" }))}>
            Create a Character
          </Link>
          <Link href="/pricing" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            View Plans
          </Link>
        </div>
      </section>
    </div>
  )
}
