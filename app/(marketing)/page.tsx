import prisma from "@/app/lib/prismadb"

import { HeroSection } from "./_components/HeroSection"
import { HOME_CHARACTER_SELECT, type CreatorRow, type HomeCharacter } from "./_components/home-data"
import {
  FeaturesSection,
  FinalCtaSection,
  HowItWorksSection,
  ModelsSection,
} from "./_components/HomeSections"
import { MarketplaceSection } from "./_components/MarketplaceSection"

export const metadata = {
  title: "InfiniStar — Chat with AI Characters",
  description:
    "Chat with anime heroes, fantasy companions, and creative AI personalities. Powered by Claude.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "InfiniStar — Chat with AI Characters",
    description: "Chat with anime heroes, fantasy companions, and creative AI personalities.",
    url: "/",
  },
}

export default async function IndexPage() {
  let featuredCharacters: HomeCharacter[] = []
  let creatorRows: CreatorRow[] = []

  try {
    ;[featuredCharacters, creatorRows] = await Promise.all([
      prisma.character.findMany({
        where: { isPublic: true, isNsfw: false },
        orderBy: [{ featured: "desc" }, { usageCount: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: HOME_CHARACTER_SELECT,
      }),
      prisma.user.findMany({
        where: {
          characters: {
            some: { isPublic: true, isNsfw: false },
          },
        },
        select: {
          id: true,
          name: true,
          image: true,
          bio: true,
          characters: {
            where: { isPublic: true, isNsfw: false },
            select: { usageCount: true, likeCount: true },
          },
        },
        take: 12,
      }),
    ])
  } catch (error) {
    console.error("Failed to load homepage marketplace data", error)
  }

  const creatorSpotlights = creatorRows
    .map((creator) => {
      const publicCharacterCount = creator.characters.length
      const totalUsageCount = creator.characters.reduce(
        (sum, character) => sum + character.usageCount,
        0
      )
      const totalLikeCount = creator.characters.reduce(
        (sum, character) => sum + character.likeCount,
        0
      )

      return {
        id: creator.id,
        name: creator.name,
        image: creator.image,
        bio: creator.bio,
        publicCharacterCount,
        totalUsageCount,
        totalLikeCount,
      }
    })
    .sort((a, b) => b.totalUsageCount - a.totalUsageCount)
    .slice(0, 3)

  return (
    <>
      <HeroSection />
      <MarketplaceSection
        featuredCharacters={featuredCharacters}
        creatorSpotlights={creatorSpotlights}
      />
      <HowItWorksSection />
      <FeaturesSection />
      <ModelsSection />
      <FinalCtaSection />
    </>
  )
}
