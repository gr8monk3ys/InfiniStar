"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/simple-input"
import { Textarea } from "@/app/components/ui/textarea"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

type CharacterFormState = {
  name: string
  tagline: string
  description: string
  greeting: string
  systemPrompt: string
  avatarUrl: string
  coverImageUrl: string
  isPublic: boolean
  tags: string
}

interface CharacterFormProps {
  initial?: Partial<CharacterFormState> & { id?: string; slug?: string }
  mode: "create" | "edit"
}

export function CharacterForm({ initial, mode }: CharacterFormProps) {
  const router = useRouter()
  const { token } = useCsrfToken()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [form, setForm] = useState<CharacterFormState>({
    name: initial?.name || "",
    tagline: initial?.tagline || "",
    description: initial?.description || "",
    greeting: initial?.greeting || "",
    systemPrompt: initial?.systemPrompt || "",
    avatarUrl: initial?.avatarUrl || "",
    coverImageUrl: initial?.coverImageUrl || "",
    isPublic: initial?.isPublic || false,
    tags: initial?.tags || "",
  })

  const handleChange = (key: keyof CharacterFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch(
        mode === "create" ? "/api/characters" : `/api/characters/${initial?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token || "",
          },
          body: JSON.stringify({
            name: form.name,
            tagline: form.tagline || undefined,
            description: form.description || undefined,
            greeting: form.greeting || undefined,
            systemPrompt: form.systemPrompt,
            avatarUrl: form.avatarUrl || undefined,
            coverImageUrl: form.coverImageUrl || undefined,
            isPublic: form.isPublic,
            tags: form.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save character")
      }

      toast.success(mode === "create" ? "Character created" : "Character updated")
      router.push(`/characters/${data.slug}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save character")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!initial?.id) return
    const confirmed = window.confirm("Delete this character? This cannot be undone.")
    if (!confirmed) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/characters/${initial.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token || "",
        },
        body: JSON.stringify({}),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete character")
      }

      toast.success("Character deleted")
      router.push("/dashboard/characters")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete character")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{mode === "create" ? "Create Character" : "Edit Character"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(event) => handleChange("name", event.target.value)}
              placeholder="e.g., Nova the Storyteller"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={form.tagline}
              onChange={(event) => handleChange("tagline", event.target.value)}
              placeholder="Short one-liner"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(event) => handleChange("description", event.target.value)}
              placeholder="Describe this character."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="greeting">Greeting</Label>
            <Textarea
              id="greeting"
              value={form.greeting}
              onChange={(event) => handleChange("greeting", event.target.value)}
              placeholder="First message the character sends."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={form.systemPrompt}
              onChange={(event) => handleChange("systemPrompt", event.target.value)}
              placeholder="Define personality, tone, rules."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatarUrl">Avatar URL</Label>
            <Input
              id="avatarUrl"
              value={form.avatarUrl}
              onChange={(event) => handleChange("avatarUrl", event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverImageUrl">Cover Image URL</Label>
            <Input
              id="coverImageUrl"
              value={form.coverImageUrl}
              onChange={(event) => handleChange("coverImageUrl", event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={form.tags}
              onChange={(event) => handleChange("tags", event.target.value)}
              placeholder="e.g., fantasy, mentor, writer"
            />
            <p className="text-xs text-muted-foreground">Comma-separated (max 10)</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(event) => handleChange("isPublic", event.target.checked)}
            />
            Make character public
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Create Character" : "Save Changes"}
            </Button>
            {mode === "edit" && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
