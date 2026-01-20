"use client"

import { useCallback } from "react"
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
}

const MessageInput: React.FC<MessageInputProps> = ({
  placeholder,
  id,
  type,
  required,
  register,
  onInputChange,
  onModifierEnter,
}) => {
  const registeredProps = register(id, { required })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Call the original register onChange
    registeredProps.onChange(e)
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
        autoComplete={id}
        {...registeredProps}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-full bg-secondary px-4 py-2 font-light text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        aria-describedby={`${id}-shortcut-hint`}
      />
      <span id={`${id}-shortcut-hint`} className="sr-only">
        Press {isMac() ? "Cmd" : "Ctrl"}+Enter to send
      </span>
    </div>
  )
}

export default MessageInput
