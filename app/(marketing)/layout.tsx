import { SiteFooter } from "@/app/components/site-footer"

export const dynamic = "force-dynamic"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  )
}
