"use client"

import { useEffect, useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import { z } from "zod"

import { cn } from "@/app/lib/utils"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/simple-input"

const emailSchema = z.string().email()

/** Commas, semicolons and whitespace separate pasted addresses. */
const EMAIL_SEPARATORS = /[,;\s]+/

interface ShareInviteFormProps {
  emails: string[]
  onChange: (emails: string[]) => void
  className?: string
  maxEmails?: number
}

export function ShareInviteForm({
  emails,
  onChange,
  className,
  maxEmails = 50,
}: ShareInviteFormProps) {
  const [inputValue, setInputValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
    }
  }, [])

  const handleAddEmail = () => {
    const email = inputValue.trim().toLowerCase()

    if (!email) {
      return
    }

    // Validate email
    const result = emailSchema.safeParse(email)
    if (!result.success) {
      setError("Enter a valid email address, like name@example.com.")
      return
    }

    // Check for duplicates
    if (emails.includes(email)) {
      setError("That email is already on the list.")
      return
    }

    // Check max emails
    if (emails.length >= maxEmails) {
      setError(`You can invite up to ${maxEmails} emails. Remove one to add another.`)
      return
    }

    onChange([...emails, email])
    setInputValue("")
    setError(null)
  }

  const handleRemoveEmail = (emailToRemove: string) => {
    onChange(emails.filter((email) => email !== emailToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddEmail()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData("text")

    // Split by common separators (comma, semicolon, newline, space)
    const pastedEmails = pastedText
      .split(EMAIL_SEPARATORS)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0)

    // A single value pastes into the field as normal; only a list is taken over
    // and split into invites.
    if (pastedEmails.length < 2) {
      return
    }
    e.preventDefault()

    const seen = new Set(emails)
    const validEmails: string[] = []
    const invalidEmails: string[] = []

    for (const email of pastedEmails) {
      const result = emailSchema.safeParse(email)
      if (result.success && !seen.has(email)) {
        seen.add(email)
        validEmails.push(email)
      } else if (!result.success) {
        invalidEmails.push(email)
      }
    }

    if (validEmails.length > 0) {
      const newEmails = [...emails, ...validEmails].slice(0, maxEmails)
      onChange(newEmails)
    }

    if (invalidEmails.length > 0) {
      setError(
        invalidEmails.length === 1
          ? "Skipped 1 address that isn't a valid email."
          : `Skipped ${invalidEmails.length} addresses that aren't valid emails.`
      )
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
      errorTimeoutRef.current = setTimeout(() => setError(null), 3000)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="invite-email">Invite by Email</Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            name="inviteEmail"
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            placeholder="name@example.com…"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className={cn(error && "border-red-500")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "email-error" : undefined}
          />
          <Button
            type="button"
            onClick={handleAddEmail}
            variant="secondary"
            size="default"
            aria-label="Add email"
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>
        {error && (
          <p id="email-error" className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Press Enter to add. You can also paste multiple emails.
        </p>
      </div>

      {emails.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">
            Invited Emails (<span className="tabular-nums">{emails.length}</span>)
          </p>
          <div className="flex flex-wrap gap-2 rounded-md border p-3">
            {emails.map((email) => (
              <Badge key={email} variant="secondary" className="max-w-full gap-1 break-all pr-1">
                {email}
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove ${email}`}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {emails.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No emails added yet. Add email addresses above to invite specific users.
        </p>
      )}
    </div>
  )
}

export default ShareInviteForm
