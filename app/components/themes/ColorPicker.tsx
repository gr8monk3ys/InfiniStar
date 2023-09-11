"use client"

import * as React from "react"

import { cn } from "@/app/lib/utils"

interface ColorPickerProps {
  label: string
  description?: string
  value: string // HSL value without hsl() wrapper, e.g., "222.2 47.4% 11.2%"
  onChange: (value: string) => void
  id: string
  className?: string
}

// Convert HSL string to hex for color input
function hslToHex(hsl: string): string {
  const parts = hsl.split(" ")
  if (parts.length < 3) return "#000000"

  const h = parseFloat(parts[0]) || 0
  const s = parseFloat(parts[1]) / 100 || 0
  const l = parseFloat(parts[2]) / 100 || 0

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h / 360 + 1 / 3)
    g = hue2rgb(p, q, h / 360)
    b = hue2rgb(p, q, h / 360 - 1 / 3)
  }

  const toHex = (x: number): string => {
    const hex = Math.round(x * 255).toString(16)
    return hex.length === 1 ? "0" + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Convert hex to HSL string
function hexToHsl(hex: string): string {
  // Remove # if present
  hex = hex.replace("#", "")

  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60
        break
      case g:
        h = ((b - r) / d + 2) * 60
        break
      case b:
        h = ((r - g) / d + 4) * 60
        break
    }
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function ColorPicker({
  label,
  description,
  value,
  onChange,
  id,
  className,
}: ColorPickerProps) {
  const hexValue = hslToHex(value)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHsl = hexToHsl(e.target.value)
    onChange(newHsl)
  }

  const handleButtonClick = () => {
    inputRef.current?.click()
  }

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex-1">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleButtonClick}
          className="size-8 rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:border-gray-600"
          style={{ backgroundColor: hexValue }}
          aria-label={`Choose ${label} color`}
        />
        <input
          ref={inputRef}
          type="color"
          id={id}
          value={hexValue}
          onChange={handleChange}
          className="sr-only"
          aria-label={`${label} color picker`}
        />
        <span className="w-20 font-mono text-xs text-gray-500 dark:text-gray-400">{hexValue}</span>
      </div>
    </div>
  )
}
