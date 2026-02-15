"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { formatDistanceToNow } from "date-fns"
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

interface ShareInfo {
  id: string
  conversationName: string
  messageCount: number
  participantCount: number
  permission: "VIEW" | "PARTICIPATE"
  shareType: "LINK" | "INVITE"
  expiresAt: string | null
}

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAuth()
  const token = params.token as string

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
      const errorMessage = err instanceof Error ? err.message : "Failed to load share information"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchShareInfo()
  }, [fetchShareInfo])

  // Handle join
  const handleJoin = async () => {
    if (!isSignedIn) {
      const redirectUrl = encodeURIComponent(`/join/${token}`)
      router.push(`/sign-in?redirect_url=${redirectUrl}`)
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
      const errorMessage = err instanceof Error ? err.message : "Failed to join conversation"
      toast.error(errorMessage)
    } finally {
      setIsJoining(false)
    }
  }

  // Handle login redirect
  const handleLogin = () => {
    const redirectUrl = encodeURIComponent(`/join/${token}`)
    router.push(`/sign-in?redirect_url=${redirectUrl}`)
  }

  // Loading state
  if (isLoading || !isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading share information...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertCircle className="size-8 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>Unable to Load Share</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => router.push("/")}>
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Share not found
  if (!shareInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
              <LinkIcon className="size-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <CardTitle>Share Not Found</CardTitle>
            <CardDescription>
              This share link may have expired, been revoked, or does not exist.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" onClick={() => router.push("/")}>
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="size-8 text-primary" />
          </div>
          <CardTitle className="text-xl">{shareInfo.conversationName}</CardTitle>
          <CardDescription>You have been invited to join this conversation</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Share Details */}
          <div className="rounded-lg border p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Messages</span>
              </div>
              <div className="text-right font-medium">{shareInfo.messageCount}</div>

              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Participants</span>
              </div>
              <div className="text-right font-medium">{shareInfo.participantCount}</div>

              <div className="flex items-center gap-2">
                {shareInfo.permission === "VIEW" ? (
                  <Eye className="size-4 text-muted-foreground" />
                ) : (
                  <Pencil className="size-4 text-muted-foreground" />
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
                    <Calendar className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Expires</span>
                  </div>
                  <div className="text-right text-muted-foreground">
                    {formatDistanceToNow(new Date(shareInfo.expiresAt), {
                      addSuffix: true,
                    })}
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
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
              <p>This is an invite-only share. Only invited email addresses can join.</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-col gap-3">
          {isSignedIn ? (
            <Button onClick={handleJoin} disabled={isJoining} className="w-full" size="lg">
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Users className="mr-2 size-4" />
                  Join Conversation
                </>
              )}
            </Button>
          ) : (
            <>
              <Button onClick={handleLogin} className="w-full" size="lg">
                <LogIn className="mr-2 size-4" />
                Log in to Join
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
