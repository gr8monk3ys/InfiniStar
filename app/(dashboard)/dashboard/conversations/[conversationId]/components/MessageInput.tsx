"use client"

import { useCallback, useSyncExternalStore } from "react"
import { type FieldErrors, type FieldValues, type UseFormRegister } from "react-hook-form"

import { isMac } from "@/app/hooks/useKeyboardShortcuts"

interface MessageInputProps {
  placeholder?: string
  id: string
  type?: string
  required?: boolean
  register: UseFormRegister<FieldValues>
  errors: FieldErrors
  /** Optional callback for typing indicator */
  onInputChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Optional callback for Cmd/Ctrl+Enter shortcut to submit */
  onModifierEnter?: () => void
  /** Accessible label for the input */
  "aria-label"?: string
}

// The platform never changes after load, so there is nothing to subscribe to.
const subscribeNoop = () => () => {}
const getIsMacOS = () =>
  navigator.platform?.toLowerCase().includes("mac") ||
  navigator.userAgent?.toLowerCase().includes("mac")
// Server (and hydration) render "Ctrl"; the client corrects it without a mismatch.
const getServerIsMacOS = () => false

const MessageInput: React.FC<MessageInputProps> = ({
  placeholder,
  id,
  type,
  required,
  register,
  onInputChange,
  onModifierEnter,
  "aria-label": ariaLabel,
}) => {
  const registeredProps = register(id, { required })

  // Detect the Mac platform without an effect + extra render, and without an SSR
  // hydration mismatch (navigator is client-only).
  const isMacOS = useSyncExternalStore(subscribeNoop, getIsMacOS, getServerIsMacOS)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Call the original register onChange
    void registeredProps.onChange(e)
    // Call the custom onChange if provided
    onInputChange?.(e)
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      const modifierPressed = isMac() ? e.metaKey : e.ctrlKey
      if (modifierPressed && e.key === "Enter") {
        e.preventDefault()
        onModifierEnter?.()
      }
    },
    [onModifierEnter]
  )

  return (
    <div className="relative w-full">
      <input
        id={id}
        type={type}
        autoComplete="off"
        {...registeredProps}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? "Message"}
        className="w-full rounded-full bg-secondary px-4 py-2 font-light text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-describedby={`${id}-shortcut-hint`}
      />
      <span id={`${id}-shortcut-hint`} className="sr-only">
        Press {isMacOS ? "Cmd" : "Ctrl"}+Enter to send
      </span>
    </div>
  )
}

export default MessageInput
