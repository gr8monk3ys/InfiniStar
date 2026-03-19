/* global process, Buffer, console */

import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const repoRoot = process.cwd()
const publicDir = path.join(repoRoot, "public")

function buildStarSvg({ size }) {
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.26
  const innerR = outerR * 0.45
  const points = []

  for (let i = 0; i < 10; i += 1) {
    const angle = (-Math.PI / 2) + (i * Math.PI) / 5
    const r = i % 2 === 0 ? outerR : innerR
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }

  const radius = Math.round(size * 0.22)

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">\n  <defs>\n    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">\n      <stop offset="0" stop-color="#7c3aed"/>\n      <stop offset="1" stop-color="#3b82f6"/>\n    </linearGradient>\n    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">\n      <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.03}" flood-color="#000000" flood-opacity="0.25"/>\n    </filter>\n  </defs>\n  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>\n  <polygon points="${points.join(" ")}" fill="#ffffff" opacity="0.96" filter="url(#shadow)"/>\n</svg>\n`
}

async function writeIconPng({ outFile, size }) {
  const svg = buildStarSvg({ size: 512 })
  const buf = Buffer.from(svg)

  await sharp(buf)
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDir, outFile))
}

async function main() {
  await fs.mkdir(publicDir, { recursive: true })

  const outputs = [
    { outFile: "favicon-16x16.png", size: 16 },
    { outFile: "favicon-32x32.png", size: 32 },
    { outFile: "apple-touch-icon.png", size: 180 },
    { outFile: "icon-192.png", size: 192 },
    { outFile: "icon-512.png", size: 512 },
  ]

  await Promise.all(outputs.map((o) => writeIconPng(o)))
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
