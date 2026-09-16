import { AuthProvider } from "@/app/components/providers/AuthProvider"

interface PricingLayoutProps {
  children: React.ReactNode
}

// The pricing page is prerendered; its "your plan" state is resolved on the
// client from the session, which this provider fetches.
export default function PricingLayout({ children }: PricingLayoutProps) {
  return <AuthProvider>{children}</AuthProvider>
}
