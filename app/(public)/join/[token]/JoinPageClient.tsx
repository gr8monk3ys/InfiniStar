"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertCircle,
  Calendar,
  Eye,
  Link as LinkIcon,
  Loader2,
  LogIn,
  MessageSquare,
  Pencil,
  Users,
} from "lucide-react"
import toast from "react-hot-toast"

import { api } from "@/app/lib/api-client"
import { formatRelative } from "@/app/lib/intl-format"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card"
import { useAppAuth } from "@/app/hooks/useAppAuth"

interface ShareInfo {
  id: string
  conversationName: string
  messageCount: number
  participantCount: number
  permission: "VIEW" | "PARTICIPATE"
  shareType: "LINK" | "INVITE"
  expiresAt: string | null
}

export default function JoinPageClient() {
  const params = useParams()
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAppAuth()
  const token = params.token as string
  const isAuthenticated = Boolean(isLoaded && isSignedIn)
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(`/join/${token}`)}`

  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch share info
  const fetchShareInfo = useCallback(async () => {
    if (!token) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get<{ shareInfo: ShareInfo }>(`/api/share/${token}`, {
        showErrorToast: false,
      })
      setShareInfo(response.shareInfo)
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Couldn't load this invite. Check your connection and reload the page."
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchShareInfo()
  }, [fetchShareInfo])

  // Handle join
  const handleJoin = async () => {
    if (!isAuthenticated) {
      router.push(signInHref)
      return
    }

    setIsJoining(true)
    try {
      const response = await api.post<{
        success: boolean
        conversationId: string
      }>(`/api/share/${token}/join`, {})

      if (response.success) {
        toast.success("Successfully joined the conversation!")
        router.push(`/dashboard/conversations/${response.conversationId}`)
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Couldn't join the conversation. Check your connection and try again."
      toast.error(errorMessage)
    } finally {
      setIsJoining(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12" role="status">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
            <p className="mt-4 text-muted-foreground">Loading share information…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
            </div>
            <CardTitle>Unable to Load Share</CardTitle>
            <CardDescription className="break-words">{error}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" asChild>
              <Link href="/">Go to Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Share not found
  if (!shareInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
              <LinkIcon
                className="size-8 text-yellow-600 dark:text-yellow-400"
                aria-hidden="true"
              />
            </div>
            <CardTitle>Share Not Found</CardTitle>
            <CardDescription>
              This share link may have expired, been revoked, or does not exist. Ask the person who
              shared it for a new link.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" asChild>
              <Link href="/">Go to Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="size-8 text-primary" aria-hidden="true" />
          </div>
          <CardTitle className="break-words text-xl">{shareInfo.conversationName}</CardTitle>
          <CardDescription>You have been invited to join this conversation</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Share Details */}
          <div className="rounded-lg border p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">Messages</span>
              </div>
              <div className="text-right font-medium tabular-nums">{shareInfo.messageCount}</div>

              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">Participants</span>
              </div>
              <div className="text-right font-medium tabular-nums">
                {shareInfo.participantCount}
              </div>

              <div className="flex items-center gap-2">
                {shareInfo.permission === "VIEW" ? (
                  <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Pencil className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="text-muted-foreground">Permission</span>
              </div>
              <div className="text-right">
                <Badge variant={shareInfo.permission === "VIEW" ? "secondary" : "default"}>
                  {shareInfo.permission === "VIEW" ? "View Only" : "Participate"}
                </Badge>
              </div>

              {shareInfo.expiresAt && (
                <>
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-muted-foreground">Expires</span>
                  </div>
                  <div className="text-right text-muted-foreground">
                    {formatRelative(shareInfo.expiresAt)}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Permission Notice */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            {shareInfo.permission === "VIEW" ? (
              <p>
                You will be able to read all messages in this conversation, but you will not be able
                to send new messages.
              </p>
            ) : (
              <p>
                You will be able to read all messages and participate by sending your own messages.
              </p>
            )}
          </div>

          {/* Invite-only notice */}
          {shareInfo.shareType === "INVITE" && (
            <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm text-primary-accent">
              <p>This is an invite-only share. Only invited email addresses can join.</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-col gap-3">
          {isAuthenticated ? (
            <Button onClick={handleJoin} disabled={isJoining} className="w-full" size="lg">
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Joining…
                </>
              ) : (
                <>
                  <Users className="mr-2 size-4" aria-hidden="true" />
                  Join Conversation
                </>
              )}
            </Button>
          ) : (
            <>
              <Button asChild className="w-full" size="lg">
                <Link href={signInHref}>
                  <LogIn className="mr-2 size-4" aria-hidden="true" />
                  Log In to Join
                </Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                You need to be logged in to join this conversation
              </p>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
