import { HiOutlineBolt, HiOutlineRocketLaunch, HiOutlineSparkles } from "react-icons/hi2"

export const HOME_CHARACTER_SELECT = {
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
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
} as const

export const starterArchetypes = [
  {
    name: "Late-Night Confidant",
    category: "Romance / Companion",
    description:
      "A warm, emotionally aware character for comfort, flirting, and long conversations that do not feel disposable.",
  },
  {
    name: "Questline Architect",
    category: "Fantasy / Roleplay",
    description:
      "A story-forward guide who can pull you into a world, keep the lore straight, and escalate tension scene by scene.",
  },
  {
    name: "Sharp Study Coach",
    category: "Education / Helper",
    description:
      "A tutor with enough backbone to challenge you, not just agree with every half-finished idea.",
  },
] as const

export const featureCards = [
  {
    number: "01",
    icon: HiOutlineSparkles,
    title: "Characters with a point of view",
    description:
      "Profiles, greetings, tags, and creator-defined tone give each character a stronger identity before the first reply.",
    wash: "from-violet-500/[0.08] to-transparent",
    iconColor: "text-violet-500",
  },
  {
    number: "02",
    icon: HiOutlineBolt,
    title: "Memory that keeps the thread",
    description:
      "Longer chats do not need to restart from zero. Save context, revisit favorites, and keep continuity over time.",
    wash: "from-fuchsia-500/[0.08] to-transparent",
    iconColor: "text-fuchsia-500",
  },
  {
    number: "03",
    icon: HiOutlineRocketLaunch,
    title: "Creator tools built into the platform",
    description:
      "Publish characters, earn support, and build an audience without stitching together a separate storefront.",
    wash: "from-amber-500/[0.08] to-transparent",
    iconColor: "text-amber-500",
  },
] as const

export const howItWorksSteps = [
  {
    step: "1",
    title: "Find a character",
    description:
      "Browse the marketplace by category — romance, fantasy, anime, study help — or search for the exact vibe you want.",
  },
  {
    step: "2",
    title: "Start the conversation",
    description:
      "Every character opens with its own greeting and voice. Streaming replies, reactions, threads, and regenerate built in.",
  },
  {
    step: "3",
    title: "Make it yours",
    description:
      "Save memories, pin favorites, remix public characters, or publish your own and build an audience around it.",
  },
] as const

export const modelCards = [
  {
    name: "Claude Sonnet 4.6",
    desc: "Balanced performance and speed",
    badge: "Recommended",
    badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  },
  {
    name: "Claude Haiku 4.5",
    desc: "Fastest responses, cost-efficient",
    badge: "Fast",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  },
] as const

export interface HomeCharacter {
  id: string
  slug: string
  name: string
  tagline: string | null
  avatarUrl: string | null
  category: string
  usageCount: number
  likeCount: number
  commentCount: number
  isNsfw: boolean
  createdBy: {
    id: string
    name: string | null
    image: string | null
  } | null
}

export interface CreatorRow {
  id: string
  name: string | null
  image: string | null
  bio: string | null
  characters: Array<{ usageCount: number; likeCount: number }>
}

export interface CreatorSpotlight {
  id: string
  name: string | null
  image: string | null
  bio: string | null
  publicCharacterCount: number
  totalUsageCount: number
  totalLikeCount: number
}

export interface MarketplaceSectionProps {
  featuredCharacters: HomeCharacter[]
  creatorSpotlights: CreatorSpotlight[]
}
