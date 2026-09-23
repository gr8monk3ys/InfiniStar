"use client"

import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import {
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineClipboard,
  HiOutlineExclamationCircle,
  HiOutlineXMark,
} from "react-icons/hi2"

import { api } from "@/app/lib/api-client"
import { formatDateTime } from "@/app/lib/intl-format"
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

/**
 * `ui/modal` renders nothing while closed, so the body below mounts on open and
 * unmounts on close: it fetches on mount and starts fresh every time, with no
 * effect watching `isOpen` to reset state.
 */
const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, conversationId }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Conversation Summary">
      <SummaryModalBody onClose={onClose} conversationId={conversationId} />
    </Modal>
  )
}

function SummaryModalBody({
  onClose,
  conversationId,
}: {
  onClose: () => void
  conversationId: string
}) {
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null)
  // Starts loading: the body mounts as the modal opens and fetches straight away.
  const [isLoading, setIsLoading] = useState(Boolean(conversationId))
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
      setError(error.message || "Couldn't load the summary. Try again.")
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

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
      const message = error.message || "Couldn't generate the summary. Try again."
      setError(message)
      toast.error(message)
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

_Generated: ${summaryData.generatedAt ? formatDateTime(summaryData.generatedAt) : "Unknown"}_`

    try {
      await navigator.clipboard.writeText(text)
      toast.success("Summary copied to clipboard")
    } catch {
      toast.error("Couldn't copy the summary. Try again.")
    }
  }

  const renderContent = () => {
    // Loading state
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-8" role="status">
          <div
            className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm text-muted-foreground">Loading summary…</p>
        </div>
      )
    }

    // Error state
    if (error && !summaryData) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <HiOutlineExclamationCircle className="size-12 text-destructive" aria-hidden="true" />
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
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
          <div className="rounded-full bg-muted p-4">
            <HiOutlineClipboard className="size-8 text-muted-foreground/70" aria-hidden="true" />
          </div>
          <h4 className="mt-4 text-lg font-medium text-foreground">No Summary Yet</h4>
          {canSummarize ? (
            <>
              <p className="mt-2 text-center text-sm text-muted-foreground">
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
                    <HiOutlineArrowPath className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    Generating…
                  </>
                ) : (
                  "Generate Summary"
                )}
              </Button>
            </>
          ) : (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              This conversation needs at least 5 messages to generate a summary.
              <br />
              <span className="tabular-nums text-muted-foreground/70">
                Current message count: {messageCount}
              </span>
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
            <HiOutlineExclamationCircle className="size-5 shrink-0" aria-hidden="true" />
            <span>
              New messages since last summary. Consider regenerating for an updated overview.
            </span>
          </div>
        )}

        {/* Overview */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Overview
          </h4>
          <p className="mt-2 text-foreground">{summary.overview}</p>
        </div>

        {/* Key Topics */}
        {summary.keyTopics.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Key Topics
            </h4>
            <ul className="mt-2 space-y-1">
              {summary.keyTopics.map((topic) => (
                <li key={topic} className="flex items-start gap-2 text-foreground">
                  <span
                    className="mt-1 block size-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  {topic}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Decisions & Action Items */}
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Decisions & Action Items
          </h4>
          {summary.decisions.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {summary.decisions.map((decision) => (
                <li key={decision} className="flex items-start gap-2 text-foreground">
                  <HiOutlineCheckCircle
                    className="mt-0.5 size-4 shrink-0 text-green-500"
                    aria-hidden="true"
                  />
                  {decision}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm italic text-muted-foreground">
              No specific decisions or action items identified.
            </p>
          )}
        </div>

        {/* Participants */}
        {summary.participants.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Participants
            </h4>
            <p className="mt-2 text-foreground">{summary.participants.join(", ")}</p>
          </div>
        )}

        {/* Metadata */}
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Generated:{" "}
            {summaryData.generatedAt ? formatDateTime(summaryData.generatedAt) : "Unknown"}
            {summaryData.messageCount ? ` | Based on ${summaryData.messageCount} messages` : null}
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
                <HiOutlineArrowPath className="mr-2 size-4 animate-spin" aria-hidden="true" />
                Regenerating…
              </>
            ) : (
              <>
                <HiOutlineArrowPath className="mr-2 size-4" aria-hidden="true" />
                Regenerate
              </>
            )}
          </Button>
          <Button onClick={copyToClipboard} variant="outline" size="sm" className="flex-1">
            <HiOutlineClipboard className="mr-2 size-4" aria-hidden="true" />
            Copy Summary
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h3 className="text-lg font-medium leading-6 text-foreground">Conversation Summary</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md text-muted-foreground/70 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close summary"
        >
          <HiOutlineXMark size={24} aria-hidden="true" />
        </button>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  )
}

export default SummaryModal
