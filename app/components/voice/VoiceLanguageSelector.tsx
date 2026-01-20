"use client"

import { useCallback, useMemo, useState } from "react"
import { HiCheck, HiChevronUpDown, HiLanguage } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"
import { VOICE_LANGUAGES, type VoiceLanguage } from "@/app/hooks/useVoiceInput"

/**
 * Props for the VoiceLanguageSelector component
 */
export interface VoiceLanguageSelectorProps {
  /** Currently selected language code */
  selectedLanguage: string
  /** Callback when language is changed */
  onLanguageChange: (languageCode: string) => void
  /** Whether the selector is disabled */
  disabled?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Show native language names */
  showNative?: boolean
  /** Additional CSS classes */
  className?: string
  /** Restrict to specific languages (by code) */
  allowedLanguages?: string[]
}

/**
 * VoiceLanguageSelector Component
 *
 * A dropdown selector for choosing the voice recognition language.
 * Supports keyboard navigation and accessibility.
 *
 * @example
 * ```tsx
 * <VoiceLanguageSelector
 *   selectedLanguage={language}
 *   onLanguageChange={setLanguage}
 * />
 * ```
 */
export function VoiceLanguageSelector({
  selectedLanguage,
  onLanguageChange,
  disabled = false,
  placeholder = "Select language",
  showNative = false,
  className,
  allowedLanguages,
}: VoiceLanguageSelectorProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  // Filter languages based on allowed list and search query
  const filteredLanguages = useMemo(() => {
    let languages = VOICE_LANGUAGES

    // Apply allowed languages filter
    if (allowedLanguages && allowedLanguages.length > 0) {
      languages = languages.filter((lang) => allowedLanguages.includes(lang.code))
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      languages = languages.filter(
        (lang) =>
          lang.name.toLowerCase().includes(query) ||
          lang.nativeName.toLowerCase().includes(query) ||
          lang.code.toLowerCase().includes(query)
      )
    }

    return languages
  }, [allowedLanguages, searchQuery])

  // Get the currently selected language object
  const selectedLang = useMemo(
    () => VOICE_LANGUAGES.find((lang) => lang.code === selectedLanguage),
    [selectedLanguage]
  )

  // Handle language selection
  const handleSelect = useCallback(
    (lang: VoiceLanguage) => {
      onLanguageChange(lang.code)
      setIsOpen(false)
      setSearchQuery("")
      setHighlightedIndex(-1)
    },
    [onLanguageChange]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setHighlightedIndex((prev) => (prev < filteredLanguages.length - 1 ? prev + 1 : prev))
          break
        case "ArrowUp":
          e.preventDefault()
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break
        case "Enter":
          e.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < filteredLanguages.length) {
            handleSelect(filteredLanguages[highlightedIndex])
          } else if (!isOpen) {
            setIsOpen(true)
          }
          break
        case "Escape":
          e.preventDefault()
          setIsOpen(false)
          setSearchQuery("")
          setHighlightedIndex(-1)
          break
        case "Tab":
          setIsOpen(false)
          break
      }
    },
    [filteredLanguages, highlightedIndex, handleSelect, isOpen]
  )

  // Toggle dropdown
  const toggleDropdown = useCallback(() => {
    if (disabled) return
    setIsOpen((prev) => !prev)
    if (!isOpen) {
      setHighlightedIndex(-1)
      setSearchQuery("")
    }
  }, [disabled, isOpen])

  // Close dropdown when clicking outside
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Check if the new focus target is within the component
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsOpen(false)
      setSearchQuery("")
      setHighlightedIndex(-1)
    }
  }, [])

  // Get display text for a language
  const getDisplayText = (lang: VoiceLanguage): string => {
    if (showNative) {
      return `${lang.name} (${lang.nativeName})`
    }
    return lang.name
  }

  return (
    <div className={cn("relative", className)} onBlur={handleBlur} onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="voice-language-label"
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "hover:bg-accent hover:text-accent-foreground",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="flex items-center gap-2">
          <HiLanguage className="size-4 text-muted-foreground" aria-hidden="true" />
          <span id="voice-language-label">
            {selectedLang ? getDisplayText(selectedLang) : placeholder}
          </span>
        </span>
        <HiChevronUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg"
          role="listbox"
          aria-label="Select voice recognition language"
          tabIndex={-1}
        >
          {/* Search input */}
          <div className="border-b border-border p-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setHighlightedIndex(0)
              }}
              placeholder="Search languages..."
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-1 focus:ring-ring"
              )}
              aria-label="Search languages"
              autoFocus
            />
          </div>

          {/* Language list */}
          <ul className="max-h-60 overflow-y-auto p-1">
            {filteredLanguages.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No languages found</li>
            ) : (
              filteredLanguages.map((lang, index) => (
                <li
                  key={lang.code}
                  role="option"
                  aria-selected={lang.code === selectedLanguage}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-sm px-3 py-2 text-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    highlightedIndex === index && "bg-accent text-accent-foreground",
                    lang.code === selectedLanguage && "font-medium"
                  )}
                  onClick={() => handleSelect(lang)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="flex flex-col">
                    <span>{lang.name}</span>
                    {showNative && lang.nativeName !== lang.name && (
                      <span className="text-xs text-muted-foreground">{lang.nativeName}</span>
                    )}
                  </span>
                  {lang.code === selectedLanguage && (
                    <HiCheck className="size-4 text-primary" aria-hidden="true" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Screen reader status */}
      <span className="sr-only" role="status" aria-live="polite">
        {selectedLang ? `Selected language: ${selectedLang.name}` : "No language selected"}
      </span>
    </div>
  )
}

/**
 * Compact version of the language selector (icon button with dropdown)
 */
export function VoiceLanguageSelectorCompact({
  selectedLanguage,
  onLanguageChange,
  disabled = false,
  className,
}: Omit<VoiceLanguageSelectorProps, "placeholder" | "showNative">): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)

  const selectedLang = useMemo(
    () => VOICE_LANGUAGES.find((lang) => lang.code === selectedLanguage),
    [selectedLanguage]
  )

  const handleSelect = useCallback(
    (lang: VoiceLanguage) => {
      onLanguageChange(lang.code)
      setIsOpen(false)
    },
    [onLanguageChange]
  )

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select language. Currently: ${selectedLang?.name || "Unknown"}`}
        className={cn(
          "flex size-8 items-center justify-center rounded-full",
          "bg-secondary text-muted-foreground",
          "hover:bg-secondary/80 hover:text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <HiLanguage className="size-4" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full right-0 z-50 mb-2 w-48 rounded-md border border-border bg-popover shadow-lg"
          role="listbox"
        >
          <ul className="max-h-48 overflow-y-auto p-1">
            {VOICE_LANGUAGES.map((lang) => (
              <li
                key={lang.code}
                role="option"
                aria-selected={lang.code === selectedLanguage}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-sm px-3 py-1.5 text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  lang.code === selectedLanguage && "bg-accent/50 font-medium"
                )}
                onClick={() => handleSelect(lang)}
              >
                <span>{lang.name}</span>
                {lang.code === selectedLanguage && (
                  <HiCheck className="size-3 text-primary" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default VoiceLanguageSelector
