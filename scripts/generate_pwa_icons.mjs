/* global process, Buffer, console */

import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

// Regenerates the static brand icons in public/ from the InfiniStar
// sparkle-star mark (the same paths as Icons.logo in app/components/icons.tsx)
// on the aurora gradient.
//
// Usage: node scripts/generate_pwa_icons.mjs

const repoRoot = process.cwd()
const publicDir = path.join(repoRoot, "public")

const MARK_LARGE =
  "M10.5 1.5c.87 5.1 4.53 8.76 9.63 9.63-5.1.87-8.76 4.53-9.63 9.63-.87-5.1-4.53-8.76-9.63-9.63 5.1-.87 8.76-4.53 9.63-9.63Z"
const MARK_SMALL =
  "M18.75 14.25c.4 2.36 2.14 4.1 4.5 4.5-2.36.4-4.1 2.14-4.5 4.5-.4-2.36-2.14-4.1-4.5-4.5 2.36-.4 4.1-2.14 4.5-4.5Z"

// The mark is drawn in a 24x24 viewBox; scale it into a 512 canvas leaving a
// margin so maskable-icon safe zones keep the full mark visible. iOS applies
// its own corner mask, so the apple touch icon stays square.
function buildIconSvg({ rounded }) {
  const rx = rounded ? 116 : 0
  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c3aed"/>
      <stop offset="0.55" stop-color="#c026d3"/>
      <stop offset="1" stop-color="#f43f5e"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>
  <g transform="translate(64,64) scale(16)" fill="#ffffff">
    <path d="${MARK_LARGE}"/>
    <path d="${MARK_SMALL}" opacity="0.55"/>
  </g>
</svg>`
}

async function writeIconPng({ outFile, size, rounded }) {
  const svg = buildIconSvg({ rounded })
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, outFile))
}

async function main() {
  await fs.mkdir(publicDir, { recursive: true })

  const outputs = [
    { outFile: "favicon-16x16.png", size: 16, rounded: true },
    { outFile: "favicon-32x32.png", size: 32, rounded: true },
    { outFile: "apple-touch-icon.png", size: 180, rounded: false },
    { outFile: "icon-192.png", size: 192, rounded: true },
    { outFile: "icon-512.png", size: 512, rounded: true },
  ]

  await Promise.all(outputs.map((o) => writeIconPng(o)))
  console.log(`Regenerated ${outputs.length} icons in public/`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
