export interface CharacterCategory {
  id: string
  name: string
  description: string
  emoji: string
  color: string
}

export const CHARACTER_CATEGORIES: CharacterCategory[] = [
  {
    id: 'general',
    name: 'General',
    description: 'All-purpose characters',
    emoji: '\u{1F31F}',
    color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Anime & manga characters',
    emoji: '\u{1F38C}',
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    description: 'Fantasy & mythical beings',
    emoji: '\u{1F9D9}',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  {
    id: 'romance',
    name: 'Romance',
    description: 'Romantic & companion characters',
    emoji: '\u{1F495}',
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  {
    id: 'helper',
    name: 'Helper',
    description: 'Productivity & assistance',
    emoji: '\u{1F916}',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'roleplay',
    name: 'Roleplay',
    description: 'Interactive story & roleplay',
    emoji: '\u{1F3AD}',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    id: 'education',
    name: 'Education',
    description: 'Learning & tutoring',
    emoji: '\u{1F4DA}',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  {
    id: 'comedy',
    name: 'Comedy',
    description: 'Humor & entertainment',
    emoji: '\u{1F602}',
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  },
  {
    id: 'adventure',
    name: 'Adventure',
    description: 'Action & exploration',
    emoji: '\u{2694}\u{FE0F}',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  {
    id: 'scifi',
    name: 'Sci-Fi',
    description: 'Science fiction worlds',
    emoji: '\u{1F680}',
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  },
]

export function getCategoryById(id: string): CharacterCategory | undefined {
  return CHARACTER_CATEGORIES.find((cat) => cat.id === id)
}

export function getCategoryName(id: string): string {
  return getCategoryById(id)?.name || 'General'
}
