"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import toast from "react-hot-toast"
import { HiChatBubbleBottomCenterText, HiTrash } from "react-icons/hi2"

import { formatDateTime, formatRelative } from "@/app/lib/intl-format"
import { cn } from "@/app/lib/utils"
import { useAppAuth } from "@/app/hooks/useAppAuth"
import { useCsrfToken, withCsrfHeader } from "@/app/hooks/useCsrfToken"

type CharacterComment = {
  id: string
  body: string
  createdAt: string
  author: {
    id: string
    name: string | null
    image: string | null
  }
  canDelete: boolean
}

export default function CharacterCommentsSection({
  characterId,
  initialCount,
}: {
  characterId: string
  initialCount: number
}) {
  const { isSignedIn } = useAppAuth()
  const { token: csrfToken } = useCsrfToken()

  const [comments, setComments] = useState<CharacterComment[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [commentBody, setCommentBody] = useState("")
  const [commentCount, setCommentCount] = useState(initialCount)
  const [bodyError, setBodyError] = useState<string | null>(null)
  // The comment whose delete is waiting on a second, confirming click.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isLoadingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const counterId = `${fieldId}-count`

  const fetchComments = useCallback(
    async (cursor?: string | null) => {
      if (isLoadingRef.current) return
      isLoadingRef.current = true
      setIsLoading(true)
      try {
        const url = new URL(`/api/characters/${characterId}/comments`, window.location.origin)
        url.searchParams.set("limit", "12")
        if (cursor) {
          url.searchParams.set("cursor", cursor)
        }

        const res = await fetch(url.toString(), { method: "GET" })
        const json = (await res.json().catch(() => null)) as {
          comments?: CharacterComment[]
          nextCursor?: string | null
          error?: string
        } | null

        if (!res.ok) {
          throw new Error(json?.error || "Couldn’t load comments. Refresh the page to try again.")
        }

        const newComments = Array.isArray(json?.comments) ? json!.comments : []
        setComments((prev) => (cursor ? [...prev, ...newComments] : newComments))
        setNextCursor(typeof json?.nextCursor === "string" ? json.nextCursor : null)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Couldn’t load comments. Check your connection and try again."
        )
      } finally {
        isLoadingRef.current = false
        setIsLoading(false)
      }
    },
    [characterId]
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    fetchComments().catch(() => {
      // handled in function
    })
  }, [fetchComments])

  const handleSubmit = useCallback(async () => {
    if (!csrfToken) {
      toast.error("Security token not available. Please refresh the page.")
      return
    }

    const trimmed = commentBody.trim()
    if (!trimmed) {
      setBodyError("Write a comment before posting.")
      textareaRef.current?.focus()
      return
    }

    setBodyError(null)
    setIsSubmitting(true)
    const loader = toast.loading("Posting comment…")

    try {
      const res = await fetch(`/api/characters/${characterId}/comments`, {
        method: "POST",
        headers: withCsrfHeader(csrfToken, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ body: trimmed }),
      })
      const json = (await res.json().catch(() => null)) as {
        comment?: CharacterComment
        commentCount?: number
        error?: string
      } | null

      if (!res.ok) {
        throw new Error(json?.error || "Couldn’t post your comment. Try again.")
      }

      const comment = json?.comment
      if (comment) {
        setComments((prev) => [comment, ...prev])
      }
      if (typeof json?.commentCount === "number") {
        setCommentCount(json.commentCount)
      } else {
        setCommentCount((prev) => prev + 1)
      }

      setCommentBody("")
      toast.success("Comment posted")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn’t post your comment. Check your connection and try again."
      )
    } finally {
      toast.dismiss(loader)
      setIsSubmitting(false)
    }
  }, [characterId, commentBody, csrfToken])

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!csrfToken) {
        toast.error("Security token not available. Please refresh the page.")
        return
      }

      setConfirmingDeleteId(null)
      setDeletingId(commentId)
      const loader = toast.loading("Deleting comment…")
      try {
        const res = await fetch(`/api/character-comments/${commentId}`, {
          method: "DELETE",
          headers: withCsrfHeader(csrfToken, {
            "Content-Type": "application/json",
          }),
        })
        const json = (await res.json().catch(() => null)) as { error?: string } | null
        if (!res.ok) {
          throw new Error(json?.error || "Couldn’t delete the comment. Try again.")
        }

        setComments((prev) => prev.filter((c) => c.id !== commentId))
        setCommentCount((prev) => Math.max(prev - 1, 0))
        toast.success("Comment deleted")
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Couldn’t delete the comment. Check your connection and try again."
        )
      } finally {
        toast.dismiss(loader)
        setDeletingId(null)
      }
    },
    [csrfToken]
  )

  return (
    <section className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HiChatBubbleBottomCenterText className="size-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Comments</h2>
          <span className="text-sm tabular-nums text-muted-foreground">({commentCount})</span>
        </div>
        {!isSignedIn ? (
          <Link
            href="/sign-in"
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Sign In to Comment
          </Link>
        ) : null}
      </div>

      {isSignedIn && (
        <div className="mt-4 flex flex-col gap-2">
          <label htmlFor={fieldId} className="sr-only">
            Comment
          </label>
          <textarea
            ref={textareaRef}
            id={fieldId}
            name="comment"
            value={commentBody}
            onChange={(e) => {
              setCommentBody(e.target.value)
              if (bodyError) setBodyError(null)
            }}
            placeholder="Share your thoughts…"
            autoComplete="off"
            aria-invalid={bodyError ? true : undefined}
            aria-describedby={bodyError ? `${errorId} ${counterId}` : counterId}
            className={cn(
              "min-h-[84px] w-full resize-y rounded-xl border bg-background px-3 py-2 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              bodyError && "border-destructive"
            )}
            maxLength={1000}
          />
          {bodyError ? (
            <p id={errorId} className="text-xs text-destructive">
              {bodyError}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span id={counterId} className="text-xs tabular-nums text-muted-foreground">
              {commentBody.length}/1000
            </span>
            <button
              type="button"
              onClick={() => {
                handleSubmit().catch(() => {
                  // handled in function
                })
              }}
              disabled={isSubmitting || !csrfToken}
              className={cn(
                "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
                "hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {isSubmitting ? "Posting…" : "Post Comment"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {comments.length === 0 && !isLoading ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No comments yet. Be the first to say something.
          </div>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="rounded-xl border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {comment.author.image ? (
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-full border">
                      <Image
                        src={comment.author.image}
                        alt={comment.author.name || "User"}
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-primary/10 text-sm font-semibold text-primary-accent">
                      {(comment.author.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {comment.author.name || "Anonymous"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)}>
                        {formatRelative(comment.createdAt)}
                      </time>
                    </p>
                  </div>
                </div>

                {comment.canDelete ? (
                  confirmingDeleteId === comment.id ? (
                    <div
                      className="flex shrink-0 items-center gap-2"
                      role="group"
                      aria-label="Confirm comment deletion"
                    >
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        // Focus moves here because the trash button that opened this
                        // step is gone; without it keyboard focus would drop to <body>.
                        autoFocus
                        onClick={() => {
                          handleDelete(comment.id).catch(() => {
                            // handled in function
                          })
                        }}
                        className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Comment
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(comment.id)}
                      disabled={deletingId === comment.id}
                      className="rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Delete comment"
                      title="Delete comment"
                    >
                      <HiTrash className="size-4" aria-hidden="true" />
                    </button>
                  )
                ) : null}
              </div>

              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-foreground">
                {comment.body}
              </p>
            </article>
          ))
        )}

        {nextCursor && (
          <button
            type="button"
            onClick={() => {
              fetchComments(nextCursor).catch(() => {
                // handled in function
              })
            }}
            disabled={isLoading}
            className="self-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Loading…" : "Load More"}
          </button>
        )}
      </div>
    </section>
  )
}
