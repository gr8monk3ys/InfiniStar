/**
 * Export Feature Type Definitions
 *
 * Types for conversation export functionality including
 * formats, data structures, and API responses.
 */

/**
 * Supported export formats
 */
export type ExportFormat = "markdown" | "json" | "txt"

/**
 * Export format option for UI display
 */
export interface ExportOption {
  format: ExportFormat
  label: string
  description: string
  extension: string
  contentType: string
}

/**
 * Participant information in export
 */
export interface ExportParticipant {
  id: string
  name: string | null
  email: string | null
}

/**
 * Message information in export
 */
export interface ExportMessage {
  id: string
  sender: string
  senderEmail?: string | null
  content: string | null
  timestamp: string
  isAI: boolean
  isDeleted: boolean
}

/**
 * Complete export data structure
 */
export interface ConversationExportData {
  conversationName: string
  conversationId: string
  isAIConversation: boolean
  aiModel?: string | null
  aiPersonality?: string | null
  participants: ExportParticipant[]
  messages: ExportMessage[]
  exportedAt: string
  totalMessages: number
}

/**
 * Export API error response
 */
export interface ExportErrorResponse {
  error: string
  success: false
}

/**
 * Available export format options for the UI
 */
export const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: "markdown",
    label: "Markdown (.md)",
    description: "Formatted document with headers",
    extension: "md",
    contentType: "text/markdown; charset=utf-8",
  },
  {
    format: "json",
    label: "JSON (.json)",
    description: "Structured data format",
    extension: "json",
    contentType: "application/json; charset=utf-8",
  },
  {
    format: "txt",
    label: "Plain Text (.txt)",
    description: "Simple readable format",
    extension: "txt",
    contentType: "text/plain; charset=utf-8",
  },
]

/**
 * Get export option by format
 */
export function getExportOption(format: ExportFormat): ExportOption | undefined {
  return EXPORT_OPTIONS.find((option) => option.format === format)
}

/**
 * Validate export format
 */
export function isValidExportFormat(format: string): format is ExportFormat {
  return ["markdown", "json", "txt"].includes(format)
}
