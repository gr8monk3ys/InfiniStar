"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import toast from "react-hot-toast"
import {
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineClipboard,
  HiOutlineExclamationCircle,
  HiOutlineXMark,
} from "react-icons/hi2"

import { api } from "@/app/lib/api-client"
import { Button } from "@/app/components/ui/button"
import Modal from "@/app/components/ui/modal"

interface SummaryModalProps {
  isOpen: boolean
  onClose: () => void
  conversationId: string
}

interface ConversationSummary {
  overview: string
  keyTopics: string[]
  decisions: string[]
  participants: string[]
}

interface SummaryResponse {
  summary: ConversationSummary | null
  generatedAt: string | null
  messageCount: number | null
  currentMessageCount?: number
  hasNewMessages?: boolean
  canSummarize?: boolean
  cached?: boolean
}

const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, conversationId }) => {
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch existing summary when modal opens
  const fetchSummary = useCallback(async () => {
    if (!conversationId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get<SummaryResponse>(
        `/api/conversations/${conversationId}/summarize`
      )
      setSummaryData(response)
    } catch (err: unknown) {
      const error = err as { message?: string }
      setError(error.message || "Failed to load summary")
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    if (isOpen) {
      fetchSummary()
    } else {
      // Reset state when modal closes
      setSummaryData(null)
      setError(null)
    }
  }, [isOpen, fetchSummary])

  // Generate or regenerate summary
  const generateSummary = async (forceRegenerate: boolean = false) => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await api.post<SummaryResponse>(
        `/api/conversations/${conversationId}/summarize`,
        { forceRegenerate }
      )
      setSummaryData(response)
      toast.success(forceRegenerate ? "Summary regenerated" : "Summary generated")
    } catch (err: unknown) {
      const error = err as { message?: string }
      setError(error.message || "Failed to generate summary")
      toast.error(error.message || "Failed to generate summary")
    } finally {
      setIsGenerating(false)
    }
  }

  // Copy summary to clipboard
  const copyToClipboard = async () => {
    if (!summaryData?.summary) return

    const summary = summaryData.summary
    const text = `## Conversation Summary

**Overview:** ${summary.overview}

**Key Topics:**
${summary.keyTopics.map((topic) => `- ${topic}`).join("\n")}

**Decisions & Action Items:**
${
  summary.decisions.length > 0
    ? summary.decisions.map((d) => `- ${d}`).join("\n")
    : "- None identified"
}

**Participants:** ${summary.participants.join(", ")}

_Generated: ${
      summaryData.generatedAt
        ? format(new Date(summaryData.generatedAt), "MMM d, yyyy h:mm a")
        : "Unknown"
    }_`

    try {
      await navigator.clipboard.writeText(text)
      toast.success("Summary copied to clipboard")
    } catch {
      toast.error("Failed to copy to clipboard")
    }
  }

  const renderContent = () => {
    // Loading state
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="size-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading summary...</p>
        </div>
      )
    }

    // Error state
    if (error && !summaryData) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <HiOutlineExclamationCircle className="size-12 text-red-500" />
          <p className="mt-4 text-sm text-red-600">{error}</p>
          <Button onClick={() => fetchSummary()} variant="outline" size="sm" className="mt-4">
            Try Again
          </Button>
        </div>
      )
    }

    // No summary exists yet
    if (!summaryData?.summary) {
      const canSummarize = summaryData?.canSummarize ?? false
      const messageCount = summaryData?.currentMessageCount ?? 0

      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="rounded-full bg-gray-100 p-4">
            <HiOutlineClipboard className="size-8 text-gray-400" />
          </div>
          <h4 className="mt-4 text-lg font-medium text-gray-900">No Summary Yet</h4>
          {canSummarize ? (
            <>
              <p className="mt-2 text-center text-sm text-gray-500">
                Generate an AI-powered summary of this conversation to quickly understand the key
                points and decisions.
              </p>
              <Button
                onClick={() => generateSummary(false)}
                disabled={isGenerating}
                className="mt-4"
              >
                {isGenerating ? (
                  <>
                    <HiOutlineArrowPath className="mr-2 size-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Summary"
                )}
              </Button>
            </>
          ) : (
            <p className="mt-2 text-center text-sm text-gray-500">
              This conversation needs at least 5 messages to generate a summary.
              <br />
              <span className="text-gray-400">Current message count: {messageCount}</span>
            </p>
          )}
        </div>
      )
    }

    // Summary exists - display it
    const summary = summaryData.summary

    return (
      <div className="space-y-4">
        {/* New messages indicator */}
        {summaryData.hasNewMessages && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <HiOutlineExclamationCircle className="size-5" />
            <span>
              New messages since last summary. Consider regenerating for an updated overview.
            </span>
          </div>
        )}

        {/* Overview */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Overview</h4>
          <p className="mt-2 text-gray-900">{summary.overview}</p>
        </div>

        {/* Key Topics */}
        {summary.keyTopics.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Key Topics
            </h4>
            <ul className="mt-2 space-y-1">
              {summary.keyTopics.map((topic) => (
                <li key={topic} className="flex items-start gap-2 text-gray-900">
                  <span className="mt-1 block size-1.5 shrink-0 rounded-full bg-sky-500" />
                  {topic}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Decisions & Action Items */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Decisions & Action Items
          </h4>
          {summary.decisions.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {summary.decisions.map((decision) => (
                <li key={decision} className="flex items-start gap-2 text-gray-900">
                  <HiOutlineCheckCircle className="mt-0.5 size-4 shrink-0 text-green-500" />
                  {decision}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm italic text-gray-500">
              No specific decisions or action items identified.
            </p>
          )}
        </div>

        {/* Participants */}
        {summary.participants.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Participants
            </h4>
            <p className="mt-2 text-gray-900">{summary.participants.join(", ")}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500">
            Generated:{" "}
            {summaryData.generatedAt
              ? format(new Date(summaryData.generatedAt), "MMM d, yyyy h:mm a")
              : "Unknown"}
            {summaryData.messageCount && ` | Based on ${summaryData.messageCount} messages`}
            {summaryData.cached && " (cached)"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => generateSummary(true)}
            disabled={isGenerating}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <HiOutlineArrowPath className="mr-2 size-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <HiOutlineArrowPath className="mr-2 size-4" />
                Regenerate
              </>
            )}
          </Button>
          <Button onClick={copyToClipboard} variant="outline" size="sm" className="flex-1">
            <HiOutlineClipboard className="mr-2 size-4" />
            Copy
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Conversation Summary</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
            aria-label="Close modal"
          >
            <HiOutlineXMark size={24} />
          </button>
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </Modal>
  )
}

export default SummaryModal
