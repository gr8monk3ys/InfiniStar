import { SiteFooter } from "@/app/components/site-footer"

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  )
}
