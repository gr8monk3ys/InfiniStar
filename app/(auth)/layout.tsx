import { SiteFooter } from "@/app/components/site-footer"

export const dynamic = "force-dynamic"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  )
}
