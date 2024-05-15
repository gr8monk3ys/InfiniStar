/**
 * AI Suggestions Components
 *
 * Components for displaying and interacting with AI-powered message suggestions.
 */

export { SuggestionCard } from "./SuggestionCard"
export { SuggestionChips } from "./SuggestionChips"
export { SuggestionPanel } from "./SuggestionPanel"
export { SuggestionSettings } from "./SuggestionSettings"
export { SuggestionsBar } from "./SuggestionsBar"

// Re-export types from the hook
export type { Suggestion, SuggestionType } from "@/app/hooks/useSuggestions"
