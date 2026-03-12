import { AuthProvider } from "@/app/components/providers/AuthProvider"
import { ThemeCustomProvider } from "@/app/components/providers/ThemeCustomProvider"

export const dynamic = "force-dynamic"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthProvider>
      <ThemeCustomProvider>{children}</ThemeCustomProvider>
    </AuthProvider>
  )
}
