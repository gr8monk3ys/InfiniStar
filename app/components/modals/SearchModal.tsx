"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { type User } from "@prisma/client"
import axios from "axios"
import { format } from "date-fns"
import toast from "react-hot-toast"
import { HiMagnifyingGlass, HiOutlineXMark } from "react-icons/hi2"

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

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, conversationId }) => {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    // Reset state when modal closes
    if (!isOpen) {
      setQuery("")
      setResults([])
      setHasSearched(false)
    }
  }, [isOpen])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) {
      toast.error("Please enter a search query")
      return
    }

    setIsSearching(true)
    setHasSearched(true)

    try {
      const params = new URLSearchParams({ query: query.trim() })
      if (conversationId) {
        params.append("conversationId", conversationId)
      }

      const response = await axios.get(`/api/messages/search?${params.toString()}`)
      setResults(response.data.messages || [])

      if (response.data.messages.length === 0) {
        toast.success("No messages found")
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || "Search failed")
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    // Navigate to conversation
    router.push(`/dashboard/conversations/${result.conversation.id}`)
    onClose()
  }

  const getConversationName = (conversation: SearchResult["conversation"]) => {
    if (conversation.name) {
      return conversation.name
    }
    if (conversation.isGroup) {
      return conversation.users.map((u) => u.name).join(", ")
    }
    return conversation.users[0]?.name || "Unknown"
  }

  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery) return text

    const parts = text.split(new RegExp(`(${searchQuery})`, "gi"))
    return parts.map((part) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark
          key={`highlight-${part}-${Math.random()}`}
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
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h3 className="text-lg font-medium leading-6 text-foreground">
            {conversationId ? "Search in conversation" : "Search messages"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md text-muted-foreground/70 hover:text-muted-foreground focus:outline-none"
          >
            <HiOutlineXMark size={24} />
          </button>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <HiMagnifyingGlass className="size-5 text-muted-foreground/70" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for messages..."
              className="block w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={isSearching}
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {hasSearched && results.length === 0 && !isSearching && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No messages found for &quot;{query}&quot;
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Found {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              {results.map((result) => (
                <div
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="cursor-pointer rounded-lg border border-border p-3 transition hover:bg-accent"
                >
                  <div className="flex items-start gap-3">
                    <Avatar user={result.sender} showPresence={false} />
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{result.sender.name}</p>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(result.createdAt), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        in {getConversationName(result.conversation)}
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {highlightMatch(result.body, query)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default SearchModal
