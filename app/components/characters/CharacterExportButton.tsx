"use client"

import { useState } from "react"
import toast from "react-hot-toast"

import { Button } from "@/app/components/ui/button"
import { useAppAuth } from "@/app/hooks/useAppAuth"

export function CharacterExportButton({ characterId }: { characterId: string }) {
  const { isSignedIn } = useAppAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleExport = async () => {
    if (!isSignedIn) {
      toast.error("Sign in to export characters")
      return
    }

    if (isLoading) return
    setIsLoading(true)

    try {
      const response = await fetch(`/api/characters/${characterId}/export`)

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error || "Failed to export character")
      }

      // Trigger file download
      const blob = await response.blob()
      const disposition = response.headers.get("Content-Disposition") || ""
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
      const filename = filenameMatch?.[1] || "character.json"

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("Character card exported")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export character")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={isLoading}>
      {isLoading ? "Exporting..." : "Export"}
    </Button>
  )
}
