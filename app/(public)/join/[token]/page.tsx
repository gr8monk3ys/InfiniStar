import type { Metadata } from "next"

import JoinPageClient from "./JoinPageClient"

export const metadata: Metadata = {
  title: "Join Conversation | Infinistar",
  description: "Review a shared conversation invite and join with your account.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function JoinPage() {
  return <JoinPageClient />
}
