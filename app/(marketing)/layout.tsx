import { SiteFooter } from "@/app/components/site-footer"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  )
}
