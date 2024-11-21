/**
 * Conversation Export Utilities
 *
 * Provides functions to export conversations in various formats:
 * - JSON: Structured data format for programmatic use
 * - Markdown: Formatted document with headers for reading
 * - Plain Text: Simple readable format without formatting
 */

import {
  getExportOption,
  type ConversationExportData,
  type ExportFormat,
  type ExportMessage,
  type ExportParticipant,
} from "@/app/types/export"

/**
 * Format a date for display in exports
 *
 * @param date - The date to format
 * @returns Formatted date string in UTC
 */
export function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC"
}

/**
 * Format a date for use in filenames
 *
 * @param date - The date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForFilename(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Sanitize a string for use in filenames
 * Removes special characters and limits length
 *
 * @param name - The string to sanitize
 * @param maxLength - Maximum length for the filename (default: 50)
 * @returns Sanitized filename string
 */
export function sanitizeFilename(name: string, maxLength: number = 50): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, maxLength)
}

/**
 * Format a username for display in exports
 *
 * @param name - User's name
 * @param email - User's email
 * @param isAI - Whether this is an AI message
 * @returns Formatted display name
 */
export function formatUsername(
  name: string | null | undefined,
  email: string | null | undefined,
  isAI: boolean = false
): string {
  if (isAI) {
    return "AI Assistant"
  }
  return name || email || "Unknown User"
}

/**
 * Convert conversation data to JSON format
 *
 * @param data - The conversation export data
 * @returns JSON string with pretty formatting
 */
export function exportToJSON(data: ConversationExportData): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Convert conversation data to Markdown format
 *
 * Creates a well-structured markdown document with:
 * - Conversation header and metadata
 * - Participant list
 * - Chronological message history
 *
 * @param data - The conversation export data
 * @returns Markdown formatted string
 */
export function exportToMarkdown(data: ConversationExportData): string {
  const lines: string[] = []

  // Header
  lines.push(`# ${escapeMarkdown(data.conversationName)}`)
  lines.push("")
  lines.push("## Conversation Details")
  lines.push("")
  lines.push(`- **Conversation ID:** \`${data.conversationId}\``)
  lines.push(`- **Total Messages:** ${data.totalMessages}`)
  lines.push(`- **Exported At:** ${data.exportedAt}`)

  if (data.isAIConversation) {
    lines.push(`- **Type:** AI Conversation`)
    if (data.aiModel) {
      lines.push(`- **AI Model:** ${data.aiModel}`)
    }
    if (data.aiPersonality) {
      lines.push(`- **AI Personality:** ${capitalizeFirst(data.aiPersonality)}`)
    }
  } else {
    lines.push(`- **Type:** User Conversation`)
  }

  lines.push("")
  lines.push("## Participants")
  lines.push("")

  for (const participant of data.participants) {
    const displayName = escapeMarkdown(formatUsername(participant.name, participant.email))
    lines.push(`- ${displayName}`)
  }

  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push("## Messages")
  lines.push("")

  for (const message of data.messages) {
    const senderDisplay = escapeMarkdown(
      formatUsername(message.sender, message.senderEmail, message.isAI)
    )
    const timestamp = message.timestamp

    lines.push(`### ${senderDisplay}`)
    lines.push(`*${timestamp}*`)
    lines.push("")

    if (message.isDeleted) {
      lines.push("*[This message was deleted]*")
    } else if (message.content) {
      // Preserve the message content but escape if needed
      lines.push(message.content)
    } else {
      lines.push("*[No content]*")
    }

    lines.push("")
  }

  lines.push("---")
  lines.push("")
  lines.push(`*Exported from InfiniStar on ${data.exportedAt}*`)

  return lines.join("\n")
}

/**
 * Convert conversation data to plain text format
 *
 * Creates a simple text document with:
 * - ASCII separators for sections
 * - Clear timestamps for each message
 * - No special formatting characters
 *
 * @param data - The conversation export data
 * @returns Plain text formatted string
 */
export function exportToText(data: ConversationExportData): string {
  const lines: string[] = []
  const separator = "=".repeat(60)
  const thinSeparator = "-".repeat(40)

  lines.push(separator)
  lines.push(`CONVERSATION: ${data.conversationName}`)
  lines.push(separator)
  lines.push("")
  lines.push("DETAILS")
  lines.push(thinSeparator)
  lines.push(`Conversation ID: ${data.conversationId}`)
  lines.push(`Total Messages: ${data.totalMessages}`)
  lines.push(`Exported At: ${data.exportedAt}`)

  if (data.isAIConversation) {
    lines.push(`Type: AI Conversation`)
    if (data.aiModel) {
      lines.push(`AI Model: ${data.aiModel}`)
    }
    if (data.aiPersonality) {
      lines.push(`AI Personality: ${capitalizeFirst(data.aiPersonality)}`)
    }
  } else {
    lines.push(`Type: User Conversation`)
  }

  lines.push("")
  lines.push("PARTICIPANTS")
  lines.push(thinSeparator)

  for (const participant of data.participants) {
    const displayName = formatUsername(participant.name, participant.email)
    lines.push(`- ${displayName}`)
  }

  lines.push("")
  lines.push(separator)
  lines.push("MESSAGES")
  lines.push(separator)
  lines.push("")

  for (const message of data.messages) {
    const senderDisplay = formatUsername(message.sender, message.senderEmail, message.isAI)
    const timestamp = message.timestamp

    lines.push(`[${timestamp}] ${senderDisplay}:`)

    if (message.isDeleted) {
      lines.push("[This message was deleted]")
    } else if (message.content) {
      lines.push(message.content)
    } else {
      lines.push("[No content]")
    }

    lines.push("")
  }

  lines.push(separator)
  lines.push(`Exported from InfiniStar on ${data.exportedAt}`)
  lines.push(separator)

  return lines.join("\n")
}

/**
 * Export conversation data to the specified format
 *
 * @param data - The conversation export data
 * @param format - The export format (json, markdown, txt)
 * @returns Formatted string in the requested format
 */
export function exportConversation(data: ConversationExportData, format: ExportFormat): string {
  switch (format) {
    case "json":
      return exportToJSON(data)
    case "markdown":
      return exportToMarkdown(data)
    case "txt":
      return exportToText(data)
    default:
      // Fallback to markdown
      return exportToMarkdown(data)
  }
}

/**
 * Get content type and file extension for an export format
 *
 * @param format - The export format
 * @returns Object with contentType and extension
 */
export function getContentTypeAndExtension(format: ExportFormat): {
  contentType: string
  extension: string
} {
  const option = getExportOption(format)
  if (option) {
    return {
      contentType: option.contentType,
      extension: option.extension,
    }
  }

  // Fallback defaults
  switch (format) {
    case "markdown":
      return { contentType: "text/markdown; charset=utf-8", extension: "md" }
    case "json":
      return { contentType: "application/json; charset=utf-8", extension: "json" }
    case "txt":
      return { contentType: "text/plain; charset=utf-8", extension: "txt" }
    default:
      return { contentType: "text/plain; charset=utf-8", extension: "txt" }
  }
}

/**
 * Generate a filename for the export
 *
 * @param conversationName - Name of the conversation
 * @param format - Export format
 * @param date - Date for the filename (defaults to now)
 * @returns Sanitized filename with extension
 */
export function generateExportFilename(
  conversationName: string,
  format: ExportFormat,
  date: Date = new Date()
): string {
  const sanitizedName = sanitizeFilename(conversationName)
  const dateStr = formatDateForFilename(date)
  const { extension } = getContentTypeAndExtension(format)
  return `${sanitizedName}_${dateStr}.${extension}`
}

/**
 * Build export data from conversation and messages
 *
 * @param conversation - Conversation object with users
 * @param messages - Array of messages with senders
 * @param currentUserId - ID of the current user (for naming)
 * @returns Formatted export data structure
 */
export function buildExportData(
  conversation: {
    id: string
    name?: string | null
    isAI: boolean
    aiModel?: string | null
    aiPersonality?: string | null
    users: Array<{
      id: string
      name: string | null
      email: string | null
    }>
  },
  messages: Array<{
    id: string
    body: string | null
    createdAt: Date
    isAI: boolean
    isDeleted: boolean
    sender: {
      id: string
      name: string | null
      email: string | null
    }
  }>,
  currentUserId: string
): ConversationExportData {
  const exportedAt = formatDate(new Date())

  // Determine conversation name
  const conversationName =
    conversation.name ||
    (conversation.isAI
      ? "AI Conversation"
      : conversation.users
          .filter((u) => u.id !== currentUserId)
          .map((u) => u.name || u.email || "Unknown")
          .join(", ") || "Conversation")

  // Build participant list
  const participants: ExportParticipant[] = conversation.users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
  }))

  // Build message list
  const exportMessages: ExportMessage[] = messages.map((message) => ({
    id: message.id,
    sender: message.sender.name || message.sender.email || "Unknown",
    senderEmail: message.sender.email,
    content: message.body,
    timestamp: formatDate(message.createdAt),
    isAI: message.isAI,
    isDeleted: message.isDeleted,
  }))

  return {
    conversationName,
    conversationId: conversation.id,
    isAIConversation: conversation.isAI,
    aiModel: conversation.aiModel,
    aiPersonality: conversation.aiPersonality,
    participants,
    messages: exportMessages,
    exportedAt,
    totalMessages: messages.length,
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Escape special markdown characters in a string
 *
 * @param text - Text to escape
 * @returns Escaped text safe for markdown
 */
function escapeMarkdown(text: string): string {
  // Only escape characters that could break markdown structure
  return text.replace(/([*_`[\]#])/g, "\\$1")
}

/**
 * Capitalize the first letter of a string
 *
 * @param str - String to capitalize
 * @returns String with first letter capitalized
 */
function capitalizeFirst(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}
