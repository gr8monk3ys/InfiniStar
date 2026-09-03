"use client"

import { useCallback, useState } from "react"
import toast from "react-hot-toast"

/**
 * Export format options
 */
export type ExportFormat = "markdown" | "json" | "txt"

export interface ExportOption {
  format: ExportFormat
  label: string
  description: string
}

export const exportOptions: ExportOption[] = [
  {
    format: "markdown",
    label: "Markdown (.md)",
    description: "Formatted document with headers",
  },
  {
    format: "json",
    label: "JSON (.json)",
    description: "Structured data format",
  },
  {
    format: "txt",
    label: "Plain Text (.txt)",
    description: "Simple readable format",
  },
]

/**
 * Export a conversation as a downloadable file. Shared by the standalone
 * ExportDropdown and the conversation header's overflow menu.
 */
export function useConversationExport(conversationId: string, conversationName = "Conversation") {
  const [isExporting, setIsExporting] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)

  /**
   * Handle export action
   */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (isExporting) return

      setIsExporting(true)
      setExportingFormat(format)

      const loadingToast = toast.loading(`Exporting as ${format}...`)

      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/export?format=${format}`,
          {
            method: "GET",
            credentials: "include",
          }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to export conversation")
        }

        // Get the filename from the Content-Disposition header
        const contentDisposition = response.headers.get("Content-Disposition")
        let filename = `${conversationName.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "_")}.${
          format === "markdown" ? "md" : format
        }`

        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/)
          if (filenameMatch?.[1]) {
            filename = filenameMatch[1]
          }
        }

        // Get the blob from the response
        const blob = await response.blob()

        // Create a download link and trigger download
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()

        // Cleanup
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)

        toast.success("Export completed!", { id: loadingToast })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to export conversation"
        toast.error(errorMessage, { id: loadingToast })
        console.error("Export error:", error)
      } finally {
        setIsExporting(false)
        setExportingFormat(null)
      }
    },
    [conversationId, conversationName, isExporting]
  )

  return { handleExport, isExporting, exportingFormat }
}
