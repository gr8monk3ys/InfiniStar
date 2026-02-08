import "@/app/globals.css"

import { type Metadata, type Viewport } from "next"
import { Inter, Sora } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"

import { siteConfig } from "@/config/site"
import { cn } from "@/app/lib/utils"
import { ThemeCustomProvider } from "@/app/components/providers/ThemeCustomProvider"
import { SiteHeader } from "@/app/components/site-header"
import { TailwindIndicator } from "@/app/components/tailwind-indicator"
import { ThemeProvider } from "@/app/components/theme-provider"
import ToasterContext from "@/app/context/ToasterContext"

const fontBody = Inter({
  subsets: ["latin"],
  variable: "--font-body",
})

const fontHeading = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800"],
})

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
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
  ],
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body
          className={cn(
            "min-h-screen bg-background antialiased",
            fontBody.variable,
            fontHeading.variable
          )}
        >
          <ToasterContext />
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <ThemeCustomProvider>
              <div className="theme-transition-bg relative flex min-h-screen flex-col">
                <SiteHeader />
                <div className="flex-1">{children}</div>
              </div>
              <TailwindIndicator />
            </ThemeCustomProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
