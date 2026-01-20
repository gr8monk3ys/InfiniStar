import { type Metadata } from "next"

export const metadata: Metadata = {
  title: "Join Conversation | InfiniStar",
  description: "Join a shared conversation on InfiniStar",
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
