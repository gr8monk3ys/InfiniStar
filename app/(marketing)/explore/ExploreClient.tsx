'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  HiMagnifyingGlass,
  HiOutlineSparkles,
  HiOutlineFire,
} from 'react-icons/hi2'
import toast from 'react-hot-toast'

import { cn } from '@/app/lib/utils'
import { CHARACTER_CATEGORIES } from '@/app/lib/character-categories'
import { CharacterCard } from '@/app/components/characters/CharacterCard'
import { buttonVariants } from '@/app/components/ui/button'
import { useCsrfToken, withCsrfHeader } from '@/app/hooks/useCsrfToken'

interface CharacterData {
  id: string
  slug: string
  name: string
  tagline?: string | null
  avatarUrl?: string | null
  category: string
  usageCount: number
  likeCount: number
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

const TABS = [
  { id: 'all', name: 'All' },
  ...CHARACTER_CATEGORIES.filter((c) => c.id !== 'general'),
]

export default function ExploreClient({
  featured,
  trending,
  all,
  likedIds: initialLikedIds,
}: ExploreClientProps) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [likedIds, setLikedIds] = useState<string[]>(initialLikedIds)
  const { token } = useCsrfToken()

  const filteredAll = useMemo(() => {
    let items = all
    if (activeCategory !== 'all') {
      items = items.filter((c) => c.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.tagline?.toLowerCase().includes(q)
      )
    }
    return items
  }, [all, activeCategory, searchQuery])

  const filteredTrending = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return trending.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.tagline?.toLowerCase().includes(q)
      )
    }
    return trending
  }, [trending, searchQuery])

  const filteredFeatured = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return featured.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.tagline?.toLowerCase().includes(q)
      )
    }
    return featured
  }, [featured, searchQuery])

  const handleLike = useCallback(
    async (characterId: string) => {
      setLikedIds((prev) => [...prev, characterId])
      try {
        const res = await fetch(
          `/api/characters/${characterId}/like`,
          {
            method: 'POST',
            headers: withCsrfHeader(token, {
              'Content-Type': 'application/json',
            }),
          }
        )
        if (!res.ok) {
          setLikedIds((prev) =>
            prev.filter((id) => id !== characterId)
          )
          const data = await res.json()
          toast.error(data.error || 'Failed to like character')
        }
      } catch {
        setLikedIds((prev) =>
          prev.filter((id) => id !== characterId)
        )
        toast.error('Failed to like character')
      }
    },
    [token]
  )

  const handleUnlike = useCallback(
    async (characterId: string) => {
      setLikedIds((prev) =>
        prev.filter((id) => id !== characterId)
      )
      try {
        const res = await fetch(
          `/api/characters/${characterId}/like`,
          {
            method: 'DELETE',
            headers: withCsrfHeader(token, {
              'Content-Type': 'application/json',
            }),
          }
        )
        if (!res.ok) {
          setLikedIds((prev) => [...prev, characterId])
          const data = await res.json()
          toast.error(data.error || 'Failed to unlike character')
        }
      } catch {
        setLikedIds((prev) => [...prev, characterId])
        toast.error('Failed to unlike character')
      }
    },
    [token]
  )

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
            Browse thousands of community-created characters. Chat with
            anime heroes, fantasy companions, helpful assistants, and
            more.
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
                'w-full rounded-full border bg-background py-3 pl-12 pr-4',
                'text-sm shadow-sm transition-shadow',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
              aria-label="Search characters"
            />
          </div>
        </div>
      </section>

      {/* Category Tabs */}
      <nav
        className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
        aria-label="Character categories"
      >
        <div className="flex gap-2 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-medium',
                'transition-colors',
                activeCategory === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-pressed={activeCategory === tab.id}
            >
              {'emoji' in tab && tab.emoji
                ? `${tab.emoji} ${tab.name}`
                : tab.name}
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
            <h2 className="text-xl font-bold">
              Trending Characters
            </h2>
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
            {activeCategory === 'all'
              ? 'All Characters'
              : TABS.find((t) => t.id === activeCategory)?.name ??
                'Characters'}
          </h2>
          <span className="text-sm text-muted-foreground">
            {filteredAll.length} character
            {filteredAll.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filteredAll.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No characters found
              {searchQuery
                ? ` matching "${searchQuery}"`
                : ' in this category'}
              .
            </p>
            <button
              onClick={() => {
                setSearchQuery('')
                setActiveCategory('all')
              }}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Clear filters
            </button>
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
        <h2 className="text-2xl font-bold md:text-3xl">
          Create Your Own Character
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Design a unique AI personality with custom instructions, a
          backstory, and greeting message. Share it with the community.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link
            href="/dashboard/characters/new"
            className={cn(buttonVariants({ size: 'lg' }))}
          >
            Create a Character
          </Link>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' })
            )}
          >
            View Plans
          </Link>
        </div>
      </section>
    </div>
  )
}
