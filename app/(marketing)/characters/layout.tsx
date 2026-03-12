import { AuthProvider } from "@/app/components/providers/AuthProvider"

interface CharacterRoutesLayoutProps {
  children: React.ReactNode
}

export default function CharacterRoutesLayout({ children }: CharacterRoutesLayoutProps) {
  return <AuthProvider>{children}</AuthProvider>
}
