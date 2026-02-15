import { NextResponse } from "next/server"

import { withCsrfProtection } from "@/app/lib/csrf"
import { sendWebPushToUser } from "@/app/lib/web-push"
import getCurrentUser from "@/app/actions/getCurrentUser"

export const POST = withCsrfProtection(async (_request: Request) => {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await sendWebPushToUser(currentUser.id, {
      title: "InfiniStar",
      body: "Test push notification",
      url: "/dashboard/profile",
      tag: "test",
    })

    if (!result.configured) {
      return NextResponse.json(
        { error: "Web push is not configured on the server." },
        { status: 501 }
      )
    }

    return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed })
  } catch (error: unknown) {
    console.error("PUSH_TEST_ERROR", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
