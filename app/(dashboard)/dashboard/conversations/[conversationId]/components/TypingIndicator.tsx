"use client"

import React, { useEffect, useState } from "react"

import { cn } from "@/app/lib/utils"

interface TypingIndicatorProps {
  /** Names of users currently typing */
  typingUsers?: string[]
  /** Whether AI is currently generating a response */
  isAITyping?: boolean
  /** Name of the character replying; falls back to a neutral label */
  characterName?: string | null
  /** Custom class name */
  className?: string
}

/**
 * TypingIndicator - Displays animated typing indicators for chat
 *
 * Shows "[User] is typing..." for human users
 * Shows "[Character] is writing..." when the character is generating a reply
 *
 * Features:
 * - Smooth fade in/out transitions
 * - Three bouncing dots animation with staggered delays
 * - Hidden from assistive tech: ConversationContainer owns the single
 *   aria-live region that announces typing, so this never double-announces
 * - Respects reduced motion preferences
 */
const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingUsers = [],
  isAITyping = false,
  characterName,
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
      return `${characterName ?? "AI"} is writing`
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
      aria-hidden="true"
    >
      {/* Animated dots container */}
      <div
        className={cn(
          "chat-bubble-ai flex items-center justify-center gap-1 rounded-2xl rounded-tl-md px-3 py-1.5"
        )}
        aria-hidden="true"
      >
        <BouncingDot delay={0} />
        <BouncingDot delay={150} />
        <BouncingDot delay={300} />
      </div>

      {/* Typing message */}
      <span className="text-sm font-medium text-muted-foreground">{getTypingMessage()}...</span>
    </div>
  )
}

/**
 * Individual bouncing dot component
 */
interface BouncingDotProps {
  delay: number
}

const BouncingDot: React.FC<BouncingDotProps> = ({ delay }) => {
  return (
    <span
      className="size-1.5 animate-typing-bounce rounded-full bg-current opacity-70"
      style={{
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

export default TypingIndicator
