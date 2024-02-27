"use client"

import { useCallback, useState } from "react"
import toast from "react-hot-toast"
import { HiOutlineArrowDownTray } from "react-icons/hi2"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"

/**
 * Export format options
 */
type ExportFormat = "markdown" | "json" | "txt"

interface ExportOption {
  format: ExportFormat
  label: string
  description: string
}

const exportOptions: ExportOption[] = [
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

interface ExportDropdownProps {
  conversationId: string
  conversationName?: string
}

const ExportDropdown: React.FC<ExportDropdownProps> = ({
  conversationId,
  conversationName = "Conversation",
}) => {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="cursor-pointer rounded-full p-2 text-sky-500 transition hover:bg-accent hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
          title="Export conversation"
          aria-label="Export conversation"
          disabled={isExporting}
        >
          {isExporting ? (
            <svg
              className="size-6 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <HiOutlineArrowDownTray size={24} />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Conversation</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {exportOptions.map((option) => (
          <DropdownMenuItem
            key={option.format}
            onClick={() => handleExport(option.format)}
            disabled={isExporting}
            className="cursor-pointer"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">
                {option.label}
                {exportingFormat === option.format && (
                  <span className="ml-2 text-xs text-muted-foreground">Exporting...</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">{option.description}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ExportDropdown
