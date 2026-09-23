import { type Metadata } from "next"

import { AuthProvider } from "@/app/components/providers/AuthProvider"

export const metadata: Metadata = {
  // The root layout template appends " - InfiniStar".
  title: "Join Conversation",
  description: "Join a shared conversation on InfiniStar",
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
