import "@/app/globals.css"
import { type Metadata, type Viewport } from "next"

import { siteConfig } from "@/config/site"
import { fontSans } from "@/app/lib/fonts"
import { cn } from "@/app/lib/utils"
import { SiteHeader } from "@/app/components/site-header"
import { TailwindIndicator } from "@/app/components/tailwind-indicator"
import { ThemeProvider } from "@/app/components/theme-provider"
import AuthContext from "@/app/context/AuthContext"
import ToasterContext from "@/app/context/ToasterContext"

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body className={cn("min-h-screen bg-background font-sans antialiased", fontSans.variable)}>
          <AuthContext>
            <ToasterContext />
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <div className="relative flex min-h-screen flex-col">
                <SiteHeader />
                <div className="flex-1">{children}</div>
              </div>
              <TailwindIndicator />
            </ThemeProvider>
          </AuthContext>
        </body>
      </html>
    </>
  )
}
