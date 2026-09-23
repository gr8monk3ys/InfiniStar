"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { type User } from "@prisma/client"
import axios from "axios"
import toast from "react-hot-toast"
import { HiMagnifyingGlass, HiOutlineXMark } from "react-icons/hi2"

import { formatDateTime } from "@/app/lib/intl-format"
import Modal from "@/app/components/ui/modal"
import Avatar from "@/app/components/Avatar"

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  conversationId?: string // Optional: search within specific conversation
}

interface SearchResult {
  id: string
  body: string
  createdAt: string
  sender: User
  conversation: {
    id: string
    name: string | null
    isGroup: boolean
    users: User[]
  }
}

const REGEXP_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g

function escapeRegExp(value: string): string {
  return value.replace(REGEXP_SPECIAL_CHARS, "\\$&")
}

function getConversationName(conversation: SearchResult["conversation"]): string {
  if (conversation.name) {
    return conversation.name
  }
  if (conversation.isGroup) {
    return conversation.users.map((u) => u.name).join(", ")
  }
  return conversation.users[0]?.name || "Unknown"
}

/**
 * The modal only mounts its body while open (`ui/modal` renders nothing when
 * closed), so the query and results reset on close without an effect.
 */
const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, conversationId }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={conversationId ? "Search in Conversation" : "Search Messages"}
    >
      <SearchModalBody onClose={onClose} conversationId={conversationId} />
    </Modal>
  )
}

function SearchModalBody({
  onClose,
  conversationId,
}: {
  onClose: () => void
  conversationId?: string
}) {
  const [query, setQuery] = useState("")
  // The query the current results belong to; highlighting and the empty state
  // follow it rather than whatever is being typed next.
  const [searchedQuery, setSearchedQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const highlightPattern = useMemo(
    () => (searchedQuery ? new RegExp(`(${escapeRegExp(searchedQuery)})`, "gi") : null),
    [searchedQuery]
  )

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = query.trim()
    if (!trimmed) {
      toast.error("Enter something to search for")
      return
    }

    setIsSearching(true)
    setHasSearched(true)

    try {
      const params = new URLSearchParams({ query: trimmed })
      if (conversationId) {
        params.append("conversationId", conversationId)
      }

      const response = await axios.get(`/api/messages/search?${params.toString()}`)
      const messages: SearchResult[] = response.data.messages || []
      setResults(messages)
      setSearchedQuery(trimmed)

      if (messages.length === 0) {
        toast.success("No messages found")
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || "Search failed. Try again.")
      setResults([])
      setSearchedQuery(trimmed)
    } finally {
      setIsSearching(false)
    }
  }

  const highlightMatch = (text: string) => {
    if (!highlightPattern) return text

    const lowerQuery = searchedQuery.toLowerCase()
    // Parts come from splitting one string, so their position is their identity.
    return text.split(highlightPattern).map((part, index) =>
      part.toLowerCase() === lowerQuery ? (
        <mark
          // eslint-disable-next-line react/no-array-index-key -- positional split segments
          key={index}
          className="rounded-sm bg-primary/20 font-medium text-foreground"
        >
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h3 className="text-lg font-medium leading-6 text-foreground">
          {conversationId ? "Search in Conversation" : "Search Messages"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="rounded-md text-muted-foreground/70 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HiOutlineXMark size={24} aria-hidden="true" />
        </button>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-4" role="search">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <HiMagnifyingGlass className="size-5 text-muted-foreground/70" aria-hidden="true" />
          </div>
          <input
            type="search"
            name="query"
            autoComplete="off"
            aria-label={conversationId ? "Search this conversation" : "Search messages"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for messages…"
            className="block w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isSearching}
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? "Searching…" : "Search"}
        </button>
      </form>

      {/* Results */}
      <div className="max-h-96 overflow-y-auto overscroll-contain">
        <div role="status" aria-live="polite">
          {hasSearched && results.length === 0 && !isSearching && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No messages found for &ldquo;{searchedQuery}&rdquo;
            </div>
          )}

          {results.length > 0 && (
            <p className="text-sm tabular-nums text-muted-foreground">
              Found {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {results.length > 0 && (
          <ul className="mt-2 space-y-2">
            {results.map((result) => (
              <li key={result.id}>
                <Link
                  href={`/dashboard/conversations/${result.conversation.id}`}
                  onClick={onClose}
                  className="block rounded-lg border border-border p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start gap-3">
                    <Avatar user={result.sender} showPresence={false} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 truncate text-sm font-medium text-foreground">
                          {result.sender.name}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(result.createdAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        in {getConversationName(result.conversation)}
                      </p>
                      <p className="mt-1 break-words text-sm text-foreground">
                        {highlightMatch(result.body)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default SearchModal
