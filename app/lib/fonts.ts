import localFont from "next/font/local"

// Self-hosted variable fonts (latin subsets) — no build-time network fetches.
// Bricolage Grotesque carries the brand voice in headings; Inter handles body copy.
export const fontHeading = localFont({
  src: "../fonts/bricolage-grotesque-latin-var.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-bricolage",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: false,
})

export const fontBody = localFont({
  src: "../fonts/inter-latin-var.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
})
