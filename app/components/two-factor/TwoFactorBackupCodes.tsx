"use client"

import { useCallback } from "react"
import { toast } from "react-hot-toast"
import { HiArrowDownTray, HiDocumentDuplicate, HiShieldCheck } from "react-icons/hi2"

interface TwoFactorBackupCodesProps {
  backupCodes: string[]
  onDone: () => void
}

export function TwoFactorBackupCodes({ backupCodes, onDone }: TwoFactorBackupCodesProps) {
  const copyBackupCodes = useCallback(() => {
    const codesText = backupCodes.join("\n")
    navigator.clipboard.writeText(codesText)
    toast.success("Backup codes copied to clipboard")
  }, [backupCodes])

  const downloadBackupCodes = useCallback(() => {
    const codesText = `InfiniStar Two-Factor Authentication Backup Codes\n${"=".repeat(
      50
    )}\n\nGenerated: ${new Date().toISOString()}\n\nIMPORTANT: Store these codes in a secure location.\nEach code can only be used once.\n\n${backupCodes
      .map((code, i) => `${i + 1}. ${code}`)
      .join("\n")}\n`

    const blob = new Blob([codesText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "infinistar-backup-codes.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Backup codes downloaded")
  }, [backupCodes])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100">
          <HiShieldCheck className="size-6 text-green-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Save Your Backup Codes</h3>
        <p className="mt-1 text-sm text-gray-600">
          Store these codes in a secure location. Each code can only be used once.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">
          Important: These codes will not be shown again. Make sure to save them now.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-4">
        {backupCodes.map((code) => (
          <code key={code} className="rounded bg-white px-3 py-2 font-mono text-sm">
            {code}
          </code>
        ))}
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={copyBackupCodes}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <HiDocumentDuplicate className="size-4" />
          Copy
        </button>
        <button
          onClick={downloadBackupCodes}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <HiArrowDownTray className="size-4" />
          Download
        </button>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onDone}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          Done
        </button>
      </div>
    </div>
  )
}
