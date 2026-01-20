"use client"

import React, { useEffect, useState } from "react"

import { cn } from "@/app/lib/utils"

interface TypingIndicatorProps {
  /** Names of users currently typing */
  typingUsers?: string[]
  /** Whether AI is currently generating a response */
  isAITyping?: boolean
  /** Custom class name */
  className?: string
}

/**
 * TypingIndicator - Displays animated typing indicators for chat
 *
 * Shows "[User] is typing..." for human users
 * Shows "AI is typing..." when AI is generating a response
 *
 * Features:
 * - Smooth fade in/out transitions
 * - Three bouncing dots animation with staggered delays
 * - Accessible with ARIA labels and live region
 * - Respects reduced motion preferences
 */
const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingUsers = [],
  isAITyping = false,
  className,
}) => {
  // Track visibility for fade animation
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  const isActive = typingUsers.length > 0 || isAITyping

  // Handle fade in/out timing
  useEffect(() => {
    if (isActive) {
      setShouldRender(true)
      // Small delay before showing to allow the component to mount
      const showTimer = setTimeout(() => setIsVisible(true), 10)
      return () => clearTimeout(showTimer)
    } else {
      setIsVisible(false)
      // Wait for fade out animation before unmounting
      const hideTimer = setTimeout(() => setShouldRender(false), 200)
      return () => clearTimeout(hideTimer)
    }
  }, [isActive])

  // Generate the typing message
  const getTypingMessage = (): string => {
    if (isAITyping) {
      return "AI is typing"
    }

    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing`
    }

    if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing`
    }

    if (typingUsers.length > 2) {
      return `${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers.length - 2} others are typing`
    }

    return ""
  }

  // Don't render if not visible
  if (!shouldRender) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 transition-all duration-200 ease-in-out",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        className
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${getTypingMessage()}...`}
    >
      {/* Animated dots container */}
      <div
        className={cn(
          "flex items-center justify-center gap-1 rounded-full px-3 py-1.5",
          isAITyping
            ? "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30"
            : "bg-muted"
        )}
        aria-hidden="true"
      >
        <BouncingDot delay={0} isAI={isAITyping} />
        <BouncingDot delay={150} isAI={isAITyping} />
        <BouncingDot delay={300} isAI={isAITyping} />
      </div>

      {/* Typing message */}
      <span
        className={cn(
          "text-sm font-medium",
          isAITyping
            ? "bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-pink-400"
            : "text-muted-foreground"
        )}
      >
        {getTypingMessage()}...
      </span>
    </div>
  )
}

/**
 * Individual bouncing dot component
 */
interface BouncingDotProps {
  delay: number
  isAI?: boolean
}

const BouncingDot: React.FC<BouncingDotProps> = ({ delay, isAI = false }) => {
  return (
    <span
      className={cn(
        "size-2 animate-typing-bounce rounded-full",
        isAI ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-muted-foreground/60"
      )}
      style={{
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

export default TypingIndicator
