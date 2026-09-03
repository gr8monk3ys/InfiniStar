"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { useRouter } from "next/navigation"
import type { CloudinaryUploadWidgetOptions, CloudinaryUploadWidgetResults } from "next-cloudinary"
import toast from "react-hot-toast"
import { HiPhoto, HiXMark } from "react-icons/hi2"

import { CHARACTER_CATEGORIES } from "@/app/lib/character-categories"
import { cn } from "@/app/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Label } from "@/app/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { Input } from "@/app/components/ui/simple-input"
import { Textarea } from "@/app/components/ui/textarea"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

import { CharacterCardFrame, type CharacterCardData } from "./CharacterCardFrame"

// Dynamic import to avoid build-time Cloudinary validation (same pattern as the composer).
const CldUploadButton = dynamic(
  () => import("next-cloudinary").then((mod) => mod.CldUploadButton),
  { ssr: false }
)
const cloudinaryUploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
const hasCloudinaryConfig = Boolean(
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && cloudinaryUploadPreset
)

const MAX_TAGS = 10
const MAX_TAG_LENGTH = 30

export type CharacterFormValues = {
  name: string
  tagline: string
  description: string
  greeting: string
  scenario: string
  exampleDialogues: string
  systemPrompt: string
  avatarUrl: string
  coverImageUrl: string
  isPublic: boolean
  isNsfw: boolean
  tags: string[]
  category: string
}

interface CharacterFormProps {
  initial?: Partial<CharacterFormValues> & {
    id?: string
    slug?: string
    usageCount?: number
    likeCount?: number
  }
  mode: "create" | "edit"
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

function personalityTemplate(name: string): string {
  const who = name.trim() || "[name]"
  return [
    `You are ${who}, [who they are in one line].`,
    "",
    "How you speak: [tone, rhythm, favourite phrases; use *asterisks* for actions].",
    "What you care about: [what drives them, what they want from this conversation].",
    "What you never do: [break character, mention being an AI, rush the story].",
  ].join("\n")
}

function exampleDialoguePlaceholder(name: string): string {
  const who = name.trim() || "Nova"
  return `Mia: How are you today?\n${who}: *adjusts glasses* Oh, splendid! I was just cataloguing some rare specimens.`
}

export function CharacterForm({ initial, mode }: CharacterFormProps) {
  const router = useRouter()
  const { token } = useCsrfToken()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const [form, setForm] = useState<CharacterFormValues>(() => ({
    name: initial?.name || "",
    tagline: initial?.tagline || "",
    description: initial?.description || "",
    greeting: initial?.greeting || "",
    scenario: initial?.scenario || "",
    exampleDialogues: initial?.exampleDialogues || "",
    systemPrompt: initial?.systemPrompt || "",
    avatarUrl: initial?.avatarUrl || "",
    coverImageUrl: initial?.coverImageUrl || "",
    isPublic: initial?.isPublic || false,
    isNsfw: initial?.isNsfw || false,
    tags: initial?.tags ?? [],
    category: initial?.category || "general",
  }))

  const initialSnapshot = useRef(JSON.stringify(form))
  const savedRef = useRef(false)
  const isDirty = JSON.stringify(form) !== initialSnapshot.current

  // Unsaved-changes guard: only while something has changed and we have not just saved.
  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (savedRef.current) return
      event.preventDefault()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  const handleChange = <K extends keyof CharacterFormValues>(
    key: K,
    value: CharacterFormValues[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const displayName = form.name.trim() || "your character"

  const previewCharacter: CharacterCardData = useMemo(
    () => ({
      id: initial?.id ?? "preview",
      slug: initial?.slug ?? "preview",
      name: form.name.trim() || "Your character",
      tagline: form.tagline.trim() || null,
      avatarUrl: isHttpUrl(form.avatarUrl) ? form.avatarUrl : null,
      category: form.category,
      usageCount: initial?.usageCount ?? 0,
      likeCount: initial?.likeCount ?? 0,
      isNsfw: form.isNsfw,
    }),
    [
      form.name,
      form.tagline,
      form.avatarUrl,
      form.category,
      form.isNsfw,
      initial?.id,
      initial?.slug,
      initial?.usageCount,
      initial?.likeCount,
    ]
  )

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
            scenario: form.scenario || undefined,
            exampleDialogues: form.exampleDialogues || undefined,
            systemPrompt: form.systemPrompt,
            avatarUrl: form.avatarUrl || undefined,
            coverImageUrl: form.coverImageUrl || undefined,
            isPublic: form.isPublic,
            isNsfw: form.isNsfw,
            category: form.category || undefined,
            tags: form.tags.map((tag) => tag.trim()).filter(Boolean),
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Couldn't save the character")
      }

      savedRef.current = true
      toast.success(mode === "create" ? `${data.name} is ready` : "Changes saved")
      router.push(`/characters/${data.slug}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the character")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!initial?.id) return
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
        throw new Error(data.error || "Couldn't delete the character")
      }

      savedRef.current = true
      toast.success(`${initial.name || "Character"} deleted`)
      router.push("/dashboard/characters")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the character")
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const deleteName = initial?.name || "this character"

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "create" ? "Create a character" : `Edit ${initial?.name || "character"}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Give them a face, a voice and a world. You can change everything later.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Identity */}
          <Section
            title="Identity"
            description="The name and face people see first, on Explore and in the feed."
          >
            <Field label="Name" htmlFor="name" required>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => handleChange("name", event.target.value)}
                placeholder="e.g. Nova the Storyteller"
                maxLength={60}
                required
              />
            </Field>

            <Field
              label="Tagline"
              htmlFor="tagline"
              help="One line under the name on the card. Who they are, in a breath."
            >
              <Input
                id="tagline"
                value={form.tagline}
                onChange={(event) => handleChange("tagline", event.target.value)}
                placeholder="A retired star-navigator who still reads the sky"
                maxLength={120}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField
                id="avatarUrl"
                label="Portrait"
                help="Shown on the card and in chat. Tall images work best."
                value={form.avatarUrl}
                onChange={(value) => handleChange("avatarUrl", value)}
                aspect="portrait"
                uploadOptions={{ maxFiles: 1, cropping: true, croppingAspectRatio: 0.75 }}
              />
              <ImageField
                id="coverImageUrl"
                label="Cover image"
                help="Wide banner across the top of the character page. Optional."
                value={form.coverImageUrl}
                onChange={(value) => handleChange("coverImageUrl", value)}
                aspect="wide"
                uploadOptions={{ maxFiles: 1, cropping: true, croppingAspectRatio: 3 }}
              />
            </div>
          </Section>

          {/* Voice */}
          <Section
            title="Voice"
            description={`How ${displayName} thinks and speaks. This is what shapes every reply.`}
          >
            <Field
              label="Greeting"
              htmlFor="greeting"
              help={`The first thing ${displayName} says when someone opens a chat.`}
            >
              <Textarea
                id="greeting"
                value={form.greeting}
                onChange={(event) => handleChange("greeting", event.target.value)}
                placeholder="*looks up from a worn star-chart* You're late. Sit. I'll tell you why the sky went quiet."
                maxLength={500}
                rows={3}
              />
            </Field>

            <Field
              label="Personality & rules"
              htmlFor="systemPrompt"
              required
              help={
                <>
                  How the character thinks, speaks and what it never does.
                  <br />
                  Written to the character, e.g. &ldquo;You are&hellip;&rdquo;
                </>
              }
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={form.systemPrompt.trim().length > 0}
                  onClick={() => handleChange("systemPrompt", personalityTemplate(form.name))}
                >
                  Start from example
                </Button>
              }
            >
              <Textarea
                id="systemPrompt"
                value={form.systemPrompt}
                onChange={(event) => handleChange("systemPrompt", event.target.value)}
                placeholder={personalityTemplate(form.name)}
                maxLength={4000}
                rows={8}
                required
              />
            </Field>

            <Field
              label="Example dialogues"
              htmlFor="exampleDialogues"
              help={`A few short exchanges, the way they'd actually read. Start each line with a name, e.g. "Mia:" and "${form.name.trim() || "Nova"}:". Optional.`}
            >
              <Textarea
                id="exampleDialogues"
                value={form.exampleDialogues}
                onChange={(event) => handleChange("exampleDialogues", event.target.value)}
                placeholder={exampleDialoguePlaceholder(form.name)}
                maxLength={4000}
                rows={6}
              />
            </Field>
          </Section>

          {/* World */}
          <Section title="World" description="Where the story starts, and how people find it.">
            <Field
              label="Scenario"
              htmlFor="scenario"
              help="The situation the chat opens in: where you are, what just happened, what's at stake."
            >
              <Textarea
                id="scenario"
                value={form.scenario}
                onChange={(event) => handleChange("scenario", event.target.value)}
                placeholder="A lighthouse on the last night before the fog season. The lamp has just gone out."
                maxLength={2000}
                rows={3}
              />
            </Field>

            <Field
              label="Description"
              htmlFor="description"
              help="The longer introduction on the character page. Backstory, looks, what a chat is like."
            >
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) => handleChange("description", event.target.value)}
                placeholder="Nova spent forty years charting stars for an empire that no longer exists..."
                maxLength={2000}
                rows={4}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <Field label="Category" htmlFor="category" help="The shelf they sit on in Explore.">
                <Select
                  value={form.category}
                  onValueChange={(value) => handleChange("category", value)}
                >
                  <SelectTrigger id="category" aria-label="Category">
                    <SelectValue placeholder="Pick a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARACTER_CATEGORIES.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.emoji} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Tags"
                htmlFor="tags"
                help={`Up to ${MAX_TAGS}. Press Enter or a comma to add one.`}
              >
                <TagInput
                  id="tags"
                  value={form.tags}
                  onChange={(tags) => handleChange("tags", tags)}
                />
              </Field>
            </div>
          </Section>

          {/* Publish */}
          <Section title="Publish" description="Who can find and chat with this character.">
            <ToggleRow
              id="isPublic"
              label="Public"
              help={`Anyone can find ${displayName} on Explore and start a chat. Off means only you can see them.`}
              checked={form.isPublic}
              onChange={(checked) => handleChange("isPublic", checked)}
            />
            <ToggleRow
              id="isNsfw"
              label="Mature (18+)"
              help="Only shown to verified adults who have turned mature content on. You must be a verified adult to set this."
              checked={form.isNsfw}
              onChange={(checked) => handleChange("isNsfw", checked)}
            />
          </Section>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : mode === "create" ? "Create character" : "Save changes"}
            </Button>
            {isDirty && !isSubmitting && (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            )}
            {mode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete character"}
              </Button>
            )}
          </div>
        </form>

        {/* Live preview */}
        <aside className="lg:sticky lg:top-20" aria-label="Card preview">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            How {displayName} looks on Explore
          </p>
          <div inert className="pointer-events-none select-none">
            <CharacterCardFrame character={previewCharacter} unoptimizedImage sizes="18rem" />
          </div>
          {form.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
              {form.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-border/60 bg-card px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
          {!form.isPublic && (
            <p className="mt-3 text-xs text-muted-foreground">
              Only you can see this until you switch on Public.
            </p>
          )}
        </aside>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&rsquo;t be undone. Chats people already have with {deleteName} will stay, but
              they&rsquo;ll no longer be linked to this character. Likes and comments on{" "}
              {deleteName} will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep character</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : `Delete ${deleteName}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ---------- Building blocks ---------- */

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )
}

function Field({
  label,
  htmlFor,
  help,
  required,
  action,
  children,
}: {
  label: string
  htmlFor: string
  help?: React.ReactNode
  required?: boolean
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="ml-1 text-muted-foreground" aria-hidden="true">
              *
            </span>
          )}
        </Label>
        {action}
      </div>
      {children}
      {help && <p className="text-xs leading-relaxed text-muted-foreground">{help}</p>}
    </div>
  )
}

function ToggleRow({
  id,
  label,
  help,
  checked,
  onChange,
}: {
  id: string
  label: string
  help: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/30"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs leading-relaxed text-muted-foreground">{help}</span>
      </span>
    </label>
  )
}

function ImageField({
  id,
  label,
  help,
  value,
  onChange,
  aspect,
  uploadOptions,
}: {
  id: string
  label: string
  help: string
  value: string
  onChange: (value: string) => void
  aspect: "portrait" | "wide"
  uploadOptions: CloudinaryUploadWidgetOptions
}) {
  const [showUrlInput, setShowUrlInput] = useState(() => Boolean(value) && !hasCloudinaryConfig)
  const hasImage = isHttpUrl(value)

  const handleUpload = (result: CloudinaryUploadWidgetResults) => {
    if (!result.info || typeof result.info === "string" || !result.info.secure_url) {
      toast.error("The upload didn't finish. Try again.")
      return
    }
    onChange(result.info.secure_url)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={showUrlInput ? id : undefined}>{label}</Label>
      <div className="flex gap-3">
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted",
            aspect === "portrait" ? "aspect-[3/4] w-20" : "aspect-[3/1] w-36"
          )}
        >
          {hasImage ? (
            <Image
              src={value}
              alt=""
              fill
              unoptimized
              sizes={aspect === "portrait" ? "5rem" : "9rem"}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <HiPhoto className="size-5" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {hasCloudinaryConfig ? (
              <CldUploadButton
                options={uploadOptions}
                onUpload={handleUpload}
                uploadPreset={cloudinaryUploadPreset}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <HiPhoto className="size-4" aria-hidden="true" />
                {hasImage ? "Replace" : "Upload"}
              </CldUploadButton>
            ) : (
              <button
                type="button"
                disabled
                title="Uploads are unavailable until Cloudinary is configured."
                className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-md border border-input px-3 text-sm font-medium text-muted-foreground opacity-70"
              >
                <HiPhoto className="size-4" aria-hidden="true" />
                Upload
              </button>
            )}
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{help}</p>
          <button
            type="button"
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            aria-expanded={showUrlInput}
            aria-controls={`${id}-url`}
            onClick={() => setShowUrlInput((open) => !open)}
          >
            {showUrlInput ? "Hide image URL" : "or paste an image URL"}
          </button>
          {showUrlInput && (
            <Input
              id={id}
              type="url"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="https://..."
              aria-label={`${label} URL`}
              className="h-9"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function TagInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string[]
  onChange: (tags: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const atLimit = value.length >= MAX_TAGS

  const commitDraft = () => {
    const tag = draft.trim().replace(/,+$/, "").trim().slice(0, MAX_TAG_LENGTH)
    setDraft("")
    if (!tag || atLimit) return
    const exists = value.some((existing) => existing.toLowerCase() === tag.toLowerCase())
    if (exists) return
    onChange([...value, tag])
  }

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      commitDraft()
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault()
      removeAt(value.length - 1)
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm ring-offset-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, index) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card py-0.5 pl-2.5 pr-1 text-xs text-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              removeAt(index)
            }}
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={`Remove tag ${tag}`}
          >
            <HiXMark className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={atLimit ? "" : value.length === 0 ? "fantasy, mentor, slow burn" : ""}
        disabled={atLimit}
        maxLength={MAX_TAG_LENGTH}
        className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        aria-label="Add a tag"
      />
    </div>
  )
}
