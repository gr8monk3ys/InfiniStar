"use client"

import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { Highlight, themes, type Language } from "prism-react-renderer"
import { HiCheck, HiClipboard } from "react-icons/hi2"

import { cn } from "@/app/lib/utils"

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
  showLineNumbers?: boolean
}

// Map common language aliases to prism-react-renderer supported languages
const languageMap: Record<string, Language> = {
  js: "javascript",
  ts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  md: "markdown",
  sql: "sql",
  json: "json",
  html: "markup",
  xml: "markup",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  go: "go",
  rust: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  csharp: "csharp",
  php: "php",
  swift: "swift",
  kotlin: "kotlin",
  scala: "scala",
  graphql: "graphql",
  diff: "diff",
}

const getLanguage = (lang?: string): Language => {
  if (!lang) return "javascript"
  const normalizedLang = lang.toLowerCase().trim()
  return languageMap[normalizedLang] || (normalizedLang as Language)
}

const getLanguageDisplayName = (lang?: string): string => {
  if (!lang) return "Code"
  const langLower = lang.toLowerCase().trim()
  const displayNames: Record<string, string> = {
    javascript: "JavaScript",
    typescript: "TypeScript",
    jsx: "JSX",
    tsx: "TSX",
    python: "Python",
    ruby: "Ruby",
    bash: "Bash",
    shell: "Shell",
    yaml: "YAML",
    json: "JSON",
    markdown: "Markdown",
    html: "HTML",
    css: "CSS",
    sql: "SQL",
    go: "Go",
    rust: "Rust",
    java: "Java",
    c: "C",
    cpp: "C++",
    csharp: "C#",
    php: "PHP",
    swift: "Swift",
    kotlin: "Kotlin",
    scala: "Scala",
    graphql: "GraphQL",
    diff: "Diff",
  }
  return displayNames[langLower] || lang.charAt(0).toUpperCase() + lang.slice(1)
}

const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
  ({ code, language, className, showLineNumbers = true }, ref) => {
    const [isCopied, setIsCopied] = useState(false)
    const [isDarkMode, setIsDarkMode] = useState(false)

    // Check for dark mode
    useEffect(() => {
      const checkDarkMode = () => {
        setIsDarkMode(document.documentElement.classList.contains("dark"))
      }

      checkDarkMode()

      // Create observer for class changes on document element
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "class") {
            checkDarkMode()
          }
        })
      })

      observer.observe(document.documentElement, { attributes: true })

      return () => observer.disconnect()
    }, [])

    const handleCopy = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(code)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
      } catch (err) {
        console.error("Failed to copy code:", err)
      }
    }, [code])

    const prismLanguage = getLanguage(language)
    const displayLanguage = getLanguageDisplayName(language)

    // Use different themes based on dark mode
    const theme = isDarkMode ? themes.nightOwl : themes.nightOwlLight

    return (
      <div
        ref={ref}
        className={cn(
          "group relative my-4 overflow-hidden rounded-lg border border-border",
          className
        )}
      >
        {/* Header with language label and copy button */}
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
          <span
            className="text-xs font-medium text-muted-foreground"
            aria-label={`Code language: ${displayLanguage}`}
          >
            {displayLanguage}
          </span>
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
            aria-label={isCopied ? "Code copied to clipboard" : "Copy code to clipboard"}
            type="button"
          >
            {isCopied ? (
              <>
                <HiCheck className="size-4 text-green-500" aria-hidden="true" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <HiClipboard className="size-4" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Code content with syntax highlighting */}
        <Highlight theme={theme} code={code.trim()} language={prismLanguage}>
          {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={cn(
                highlightClassName,
                "overflow-x-auto p-4 text-sm leading-relaxed",
                isDarkMode ? "bg-[#011627]" : "bg-[#f6f8fa]"
              )}
              style={style}
              tabIndex={0}
              role="region"
              aria-label={`Code block in ${displayLanguage}`}
            >
              <code className="inline-block min-w-full">
                {/* eslint-disable react/no-array-index-key -- Line numbers are stable and don't reorder */}
                {tokens.map((line, i) => {
                  const lineProps = getLineProps({ line })
                  return (
                    <div
                      key={`line-${i}`}
                      {...lineProps}
                      className={cn(lineProps.className, "table-row")}
                    >
                      {showLineNumbers && (
                        <span
                          className={cn(
                            "table-cell select-none pr-4 text-right text-muted-foreground",
                            isDarkMode ? "text-gray-500" : "text-gray-400"
                          )}
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                      )}
                      <span className="table-cell">
                        {line.map((token, key) => (
                          <span key={`token-${key}`} {...getTokenProps({ token })} />
                        ))}
                      </span>
                    </div>
                  )
                })}
                {/* eslint-enable react/no-array-index-key */}
              </code>
            </pre>
          )}
        </Highlight>
      </div>
    )
  }
)

CodeBlock.displayName = "CodeBlock"

export { CodeBlock }
export type { CodeBlockProps }
