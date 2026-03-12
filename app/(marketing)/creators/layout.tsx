import { AuthProvider } from "@/app/components/providers/AuthProvider"

interface CreatorRoutesLayoutProps {
  children: React.ReactNode
}

export default function CreatorRoutesLayout({ children }: CreatorRoutesLayoutProps) {
  return <AuthProvider>{children}</AuthProvider>
}
