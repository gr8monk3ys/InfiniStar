"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"

import { Button, buttonVariants } from "@/app/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { useCsrfToken } from "@/app/hooks/useCsrfToken"

type ImportState = "idle" | "loading" | "success"

interface ImportResult {
  character: { id: string; name: string; slug: string }
  warnings: string[]
  message: string
}

export default function ImportCharacterPage() {
  const { token } = useCsrfToken()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ImportState>("idle")
  const [dragActive, setDragActive] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const importFile = useCallback(
    async (file: File) => {
      setState("loading")
      setError(null)
      setResult(null)

      try {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/characters/import", {
          method: "POST",
          headers: {
            "X-CSRF-Token": token || "",
          },
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Import failed. Check the file and try again.")
        }

        setState("success")
        setResult(data as ImportResult)
        toast.success(data.message || "Character imported")
      } catch (err) {
        setState("idle")
        const message =
          err instanceof Error ? err.message : "Import failed. Check the file and try again."
        setError(message)
        toast.error(message)
      }
    },
    [token]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)

      const file = e.dataTransfer.files[0]
      if (!file) return

      const name = file.name.toLowerCase()
      if (!name.endsWith(".json") && !name.endsWith(".png")) {
        setError("Unsupported file type. Drop a .json or .png character card.")
        return
      }

      void importFile(file)
    },
    [importFile]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      void importFile(file)
      e.target.value = ""
    },
    [importFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Import Character</h1>
        <p className="text-sm text-muted-foreground">
          Import a character card in V2 JSON format or from a PNG with embedded data.
        </p>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Upload Character Card</CardTitle>
        </CardHeader>
        <CardContent>
          {state === "success" && result ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                <p className="font-medium text-green-900 dark:text-green-100">{result.message}</p>
                {result.warnings.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-green-800 dark:text-green-200">
                    {result.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/dashboard/characters/${result.character.id}/edit`}
                  className={buttonVariants()}
                >
                  Edit Character
                </Link>
                <Link
                  href={`/characters/${result.character.slug}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  View Character
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setState("idle")
                    setResult(null)
                  }}
                >
                  Import Another
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                id="file-input"
                name="file"
                type="file"
                accept=".json,.png"
                onChange={handleFileSelect}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                disabled={state === "loading"}
                className={`flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                aria-label="Drop a character card file here or click to browse"
                aria-describedby={error ? "import-error" : undefined}
              >
                {state === "loading" ? (
                  <span className="text-sm text-muted-foreground" aria-live="polite">
                    Importing character…
                  </span>
                ) : (
                  <>
                    <span className="text-lg font-medium">Drop a character card here</span>
                    <span className="mt-1 text-sm text-muted-foreground">
                      or click to browse — accepts <span translate="no">.json</span> and{" "}
                      <span translate="no">.png</span> files
                    </span>
                  </>
                )}
              </button>

              {error && (
                <div
                  id="import-error"
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
                >
                  {error}
                </div>
              )}

              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="font-medium">Supported formats:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>V2 Character Card</strong> — Standard JSON format used by SillyTavern,
                    Chub.ai, and other platforms
                  </li>
                  <li>
                    <strong>PNG Character Card</strong> — PNG image with embedded character data (as
                    used on Chub.ai)
                  </li>
                  <li>
                    <strong>V1 Character Card</strong> — Legacy format (auto-detected)
                  </li>
                </ul>
                <p>
                  Imported characters are created as private by default. Max file size: 10&nbsp;MB.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
