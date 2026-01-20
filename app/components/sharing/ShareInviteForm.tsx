"use client"

import { useState } from "react"
import { Plus, X } from "lucide-react"
import { z } from "zod"

import { cn } from "@/app/lib/utils"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/simple-input"

const emailSchema = z.string().email()

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

  const handleAddEmail = () => {
    const email = inputValue.trim().toLowerCase()

    if (!email) {
      return
    }

    // Validate email
    const result = emailSchema.safeParse(email)
    if (!result.success) {
      setError("Please enter a valid email address")
      return
    }

    // Check for duplicates
    if (emails.includes(email)) {
      setError("This email has already been added")
      return
    }

    // Check max emails
    if (emails.length >= maxEmails) {
      setError(`Maximum ${maxEmails} emails allowed`)
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
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")

    // Split by common separators (comma, semicolon, newline, space)
    const pastedEmails = pastedText
      .split(/[,;\s\n]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0)

    const validEmails: string[] = []
    const invalidEmails: string[] = []

    for (const email of pastedEmails) {
      const result = emailSchema.safeParse(email)
      if (result.success && !emails.includes(email) && !validEmails.includes(email)) {
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
      setError(`${invalidEmails.length} invalid email(s) skipped`)
      setTimeout(() => setError(null), 3000)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="invite-email">Invite by Email</Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            type="email"
            placeholder="Enter email address"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className={cn(error && "border-red-500")}
            aria-describedby={error ? "email-error" : undefined}
          />
          <Button
            type="button"
            onClick={handleAddEmail}
            variant="secondary"
            size="default"
            aria-label="Add email"
          >
            <Plus className="size-4" />
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
          <Label>Invited Emails ({emails.length})</Label>
          <div className="flex flex-wrap gap-2 rounded-md border p-3">
            {emails.map((email) => (
              <Badge key={email} variant="secondary" className="gap-1 pr-1">
                {email}
                <button
                  type="button"
                  onClick={() => handleRemoveEmail(email)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove ${email}`}
                >
                  <X className="size-3" />
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
