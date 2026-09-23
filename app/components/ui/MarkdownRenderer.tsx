"use client"

import * as React from "react"
import { useMemo } from "react"

import { cn } from "@/app/lib/utils"

import { LazyCodeBlock as CodeBlock } from "./LazyCodeBlock"

interface MarkdownRendererProps {
  content: string
  className?: string
}

interface ParsedContent {
  type: "text" | "code-block" | "inline-code"
  content: string
  language?: string
}

/**
 * Parses markdown content and extracts code blocks
 * Handles:
 * - Fenced code blocks (```language\ncode```)
 * - Inline code (`code`)
 * - Regular text
 */
// Regex for fenced code blocks: ```language\ncode```
// Captures: optional language, code content. Hoisted; `matchAll` clones it per
// call, so the shared `lastIndex` of a /g regex is never reused across calls.
const CODE_BLOCK_REGEX = /```(\w*)\n?([\s\S]*?)```/g
const INLINE_CODE_REGEX = /`([^`]+)`/g

const parseMarkdownContent = (content: string): ParsedContent[] => {
  const result: ParsedContent[] = []

  let lastIndex = 0

  for (const match of content.matchAll(CODE_BLOCK_REGEX)) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index)
      if (textBefore.trim()) {
        result.push(...parseInlineCode(textBefore))
      }
    }

    // Add the code block
    const language = match[1] || undefined
    const code = match[2]

    result.push({
      type: "code-block",
      content: code,
      language,
    })

    lastIndex = match.index + match[0].length
  }

  // Add any remaining text after the last code block
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex)
    if (remainingText.trim()) {
      result.push(...parseInlineCode(remainingText))
    }
  }

  // If no code blocks were found, parse the entire content for inline code
  if (result.length === 0 && content.trim()) {
    result.push(...parseInlineCode(content))
  }

  return result
}

/**
 * Parses text for inline code segments
 */
const parseInlineCode = (text: string): ParsedContent[] => {
  const result: ParsedContent[] = []

  let lastIndex = 0

  for (const match of text.matchAll(INLINE_CODE_REGEX)) {
    // Add text before the inline code
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index)
      if (textBefore) {
        result.push({
          type: "text",
          content: textBefore,
        })
      }
    }

    // Add the inline code
    result.push({
      type: "inline-code",
      content: match[1],
    })

    lastIndex = match.index + match[0].length
  }

  // Add any remaining text after the last inline code
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex)
    if (remainingText) {
      result.push({
        type: "text",
        content: remainingText,
      })
    }
  }

  // If no inline code was found, return the entire text as a single segment
  if (result.length === 0 && text) {
    result.push({
      type: "text",
      content: text,
    })
  }

  return result
}

/**
 * Renders inline code with styling
 */
const InlineCode: React.FC<{ children: string }> = ({ children }) => (
  <code
    className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm", "text-primary-accent")}
    translate="no"
  >
    {children}
  </code>
)

/**
 * Renders text content with preserved whitespace and line breaks
 */
const TextContent: React.FC<{ content: string }> = ({ content }) => {
  // Split by newlines and render paragraphs
  const lines = content.split("\n")

  return (
    <>
      {/* eslint-disable react/no-array-index-key -- Text lines are stable and don't reorder */}
      {lines.map((line, index) => (
        <React.Fragment key={`text-line-${index}`}>
          {line}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
      {/* eslint-enable react/no-array-index-key */}
    </>
  )
}

/**
 * MarkdownRenderer component
 *
 * Renders markdown content with syntax-highlighted code blocks
 * and styled inline code.
 */
const MarkdownRenderer = React.forwardRef<HTMLDivElement, MarkdownRendererProps>(
  ({ content, className }, ref) => {
    const parsedContent = useMemo(() => parseMarkdownContent(content), [content])

    // Check if content contains only text (no code blocks)
    const hasOnlyText = parsedContent.every(
      (segment) => segment.type === "text" || segment.type === "inline-code"
    )

    return (
      <div
        ref={ref}
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none break-words",
          // Only add prose classes if there are code blocks
          hasOnlyText ? "" : "prose-pre:p-0 prose-pre:bg-transparent",
          className
        )}
      >
        {/* eslint-disable react/no-array-index-key -- Parsed segments are stable and don't reorder */}
        {parsedContent.map((segment, index) => {
          switch (segment.type) {
            case "code-block":
              return (
                <CodeBlock
                  key={`segment-${index}`}
                  code={segment.content}
                  language={segment.language}
                  showLineNumbers={segment.content.includes("\n")}
                />
              )
            case "inline-code":
              return <InlineCode key={`segment-${index}`}>{segment.content}</InlineCode>
            case "text":
            default:
              return <TextContent key={`segment-${index}`} content={segment.content} />
          }
        })}
        {/* eslint-enable react/no-array-index-key */}
      </div>
    )
  }
)

MarkdownRenderer.displayName = "MarkdownRenderer"

export { MarkdownRenderer, parseMarkdownContent }
export type { MarkdownRendererProps, ParsedContent }
