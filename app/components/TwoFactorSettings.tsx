"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { toast } from "react-hot-toast"
import {
  HiArrowDownTray,
  HiDocumentDuplicate,
  HiEye,
  HiEyeSlash,
  HiKey,
  HiShieldCheck,
  HiShieldExclamation,
} from "react-icons/hi2"

import { ApiError, api, createLoadingToast } from "@/app/lib/api-client"

interface TwoFactorSettingsProps {
  initialEnabled?: boolean
  hasPassword: boolean
}

type SetupStep = "idle" | "scanning" | "verifying" | "backup-codes"

interface SetupData {
  secret: string
  qrCode: string
}

export function TwoFactorSettings({ initialEnabled = false, hasPassword }: TwoFactorSettingsProps) {
  const [isEnabled, setIsEnabled] = useState(initialEnabled)
  const [setupStep, setSetupStep] = useState<SetupStep>("idle")
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [remainingBackupCodes, setRemainingBackupCodes] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  // Verification code input
  const [verificationCode, setVerificationCode] = useState<string[]>(Array(6).fill(""))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Disable 2FA form
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [disableCode, setDisableCode] = useState("")
  const [showDisablePassword, setShowDisablePassword] = useState(false)

  // Regenerate backup codes form
  const [showRegenerateForm, setShowRegenerateForm] = useState(false)
  const [regeneratePassword, setRegeneratePassword] = useState("")
  const [regenerateCode, setRegenerateCode] = useState("")
  const [showRegeneratePassword, setShowRegeneratePassword] = useState(false)

  // Fetch 2FA status on mount
  useEffect(() => {
    const fetch2FAStatus = async () => {
      try {
        const response = await api.get<{ twoFactorEnabled: boolean }>("/api/profile", {
          showErrorToast: false,
        })
        setIsEnabled(response.twoFactorEnabled ?? false)

        if (response.twoFactorEnabled) {
          const backupResponse = await api.get<{ remainingCodes: number }>(
            "/api/auth/2fa/backup-codes",
            { showErrorToast: false }
          )
          setRemainingBackupCodes(backupResponse.remainingCodes)
        }
      } catch {
        // Ignore errors
      }
    }
    fetch2FAStatus()
  }, [])

  const handleStartSetup = useCallback(async () => {
    if (!hasPassword) {
      toast.error("Two-factor authentication requires a password. Please set up a password first.")
      return
    }

    setIsLoading(true)
    const loader = createLoadingToast("Setting up 2FA...")

    try {
      const response = await api.post<SetupData>(
        "/api/auth/2fa/setup",
        {},
        {
          showErrorToast: false,
        }
      )

      setSetupData(response)
      setSetupStep("scanning")
      loader.dismiss()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to start 2FA setup"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [hasPassword])

  const handleCodeChange = useCallback(
    (index: number, value: string) => {
      if (value && !/^\d$/.test(value)) return

      const newCode = [...verificationCode]
      newCode[index] = value
      setVerificationCode(newCode)

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    },
    [verificationCode]
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      } else if (e.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus()
      } else if (e.key === "ArrowRight" && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    },
    [verificationCode]
  )

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").trim()
    if (/^\d{6}$/.test(pastedData)) {
      setVerificationCode(pastedData.split(""))
      inputRefs.current[5]?.focus()
    }
  }, [])

  const handleVerifySetup = useCallback(async () => {
    const code = verificationCode.join("")
    if (code.length !== 6) {
      toast.error("Please enter all 6 digits")
      return
    }

    setIsLoading(true)
    const loader = createLoadingToast("Verifying code...")

    try {
      const response = await api.post<{ backupCodes: string[] }>(
        "/api/auth/2fa/verify",
        {
          code,
        },
        {
          showErrorToast: false,
        }
      )

      setBackupCodes(response.backupCodes)
      setSetupStep("backup-codes")
      setIsEnabled(true)
      setRemainingBackupCodes(response.backupCodes.length)
      loader.success("Two-factor authentication enabled!")
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to verify code"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [verificationCode])

  const handleDisable2FA = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!disablePassword || !disableCode) {
        toast.error("Please enter both your password and verification code")
        return
      }

      setIsLoading(true)
      const loader = createLoadingToast("Disabling 2FA...")

      try {
        await api.post(
          "/api/auth/2fa/disable",
          {
            password: disablePassword,
            code: disableCode,
          },
          {
            showErrorToast: false,
          }
        )

        setIsEnabled(false)
        setShowDisableForm(false)
        setDisablePassword("")
        setDisableCode("")
        setRemainingBackupCodes(null)
        loader.success("Two-factor authentication disabled")
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Failed to disable 2FA"
        loader.error(message)
      } finally {
        setIsLoading(false)
      }
    },
    [disablePassword, disableCode]
  )

  const handleRegenerateBackupCodes = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!regeneratePassword || !regenerateCode) {
        toast.error("Please enter both your password and verification code")
        return
      }

      setIsLoading(true)
      const loader = createLoadingToast("Generating new backup codes...")

      try {
        const response = await api.post<{ backupCodes: string[] }>(
          "/api/auth/2fa/backup-codes",
          {
            password: regeneratePassword,
            code: regenerateCode,
          },
          {
            showErrorToast: false,
          }
        )

        setBackupCodes(response.backupCodes)
        setRemainingBackupCodes(response.backupCodes.length)
        setShowRegenerateForm(false)
        setRegeneratePassword("")
        setRegenerateCode("")
        setSetupStep("backup-codes")
        loader.success("New backup codes generated!")
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : "Failed to generate backup codes"
        loader.error(message)
      } finally {
        setIsLoading(false)
      }
    },
    [regeneratePassword, regenerateCode]
  )

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

  const resetSetup = useCallback(() => {
    setSetupStep("idle")
    setSetupData(null)
    setBackupCodes([])
    setVerificationCode(Array(6).fill(""))
    setShowSecret(false)
  }, [])

  // Not enabled state
  if (!isEnabled && setupStep === "idle") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gray-200">
            <HiShieldExclamation className="size-6 text-gray-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">Two-Factor Authentication is Off</h3>
            <p className="mt-1 text-sm text-gray-600">
              Add an extra layer of security to your account by enabling two-factor authentication.
              You will need an authenticator app like Google Authenticator or Authy.
            </p>
            {!hasPassword && (
              <p className="mt-2 text-sm text-amber-600">
                Note: You need to set up a password before enabling 2FA. OAuth-only accounts cannot
                use 2FA.
              </p>
            )}
            <button
              onClick={handleStartSetup}
              disabled={isLoading || !hasPassword}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HiShieldCheck className="size-4" />
              Enable Two-Factor Authentication
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Scanning QR code step
  if (setupStep === "scanning" && setupData) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">Scan QR Code</h3>
          <p className="mt-1 text-sm text-gray-600">
            Open your authenticator app and scan this QR code
          </p>
        </div>

        <div className="flex justify-center">
          <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
            <Image
              src={setupData.qrCode}
              alt="QR Code for authenticator app"
              width={200}
              height={200}
              className="rounded"
            />
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <p className="mb-2 text-sm font-medium text-gray-700">
            Cannot scan the code? Enter this key manually:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-gray-200 px-3 py-2 font-mono text-sm">
              {showSecret ? setupData.secret : "••••••••••••••••"}
            </code>
            <button
              onClick={() => setShowSecret(!showSecret)}
              className="p-2 text-gray-500 hover:text-gray-700"
              aria-label={showSecret ? "Hide secret key" : "Show secret key"}
            >
              {showSecret ? <HiEyeSlash className="size-5" /> : <HiEye className="size-5" />}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(setupData.secret)
                toast.success("Secret key copied")
              }}
              className="p-2 text-gray-500 hover:text-gray-700"
              aria-label="Copy secret key"
            >
              <HiDocumentDuplicate className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={resetSetup} className="text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={() => {
              setSetupStep("verifying")
              setTimeout(() => inputRefs.current[0]?.focus(), 100)
            }}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // Verification step
  if (setupStep === "verifying") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">Verify Setup</h3>
          <p className="mt-1 text-sm text-gray-600">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <div
          className="flex justify-center gap-2"
          onPaste={handlePaste}
          role="group"
          aria-label="6-digit verification code"
        >
          {/* eslint-disable react/no-array-index-key -- Fixed position PIN digit inputs */}
          {verificationCode.map((digit, index) => (
            <input
              key={`verify-digit-${index}`}
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              className="size-12 rounded-lg border-2 border-gray-300 text-center text-xl font-semibold focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-gray-100"
              aria-label={`Digit ${index + 1}`}
            />
          ))}
          {/* eslint-enable react/no-array-index-key */}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setSetupStep("scanning")}
            disabled={isLoading}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Back
          </button>
          <button
            onClick={handleVerifySetup}
            disabled={isLoading || verificationCode.some((d) => !d)}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Verifying..." : "Verify"}
          </button>
        </div>
      </div>
    )
  }

  // Backup codes display
  if (setupStep === "backup-codes" && backupCodes.length > 0) {
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
            onClick={resetSetup}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  // Enabled state - management view
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4 rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100">
          <HiShieldCheck className="size-6 text-green-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">Two-Factor Authentication is On</h3>
          <p className="mt-1 text-sm text-gray-600">
            Your account is protected with two-factor authentication.
          </p>
          {remainingBackupCodes !== null && (
            <p className="mt-2 text-sm text-gray-600">
              <HiKey className="mr-1 inline size-4" />
              {remainingBackupCodes} backup code{remainingBackupCodes !== 1 ? "s" : ""} remaining
            </p>
          )}
        </div>
      </div>

      {/* Regenerate Backup Codes */}
      {!showRegenerateForm ? (
        <button
          onClick={() => setShowRegenerateForm(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700"
        >
          <HiKey className="size-4" />
          Generate new backup codes
        </button>
      ) : (
        <form onSubmit={handleRegenerateBackupCodes} className="space-y-4 rounded-lg border p-4">
          <h4 className="font-medium text-gray-900">Generate New Backup Codes</h4>
          <p className="text-sm text-gray-600">This will invalidate all existing backup codes.</p>

          <div>
            <label htmlFor="regeneratePassword" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="regeneratePassword"
                type={showRegeneratePassword ? "text" : "password"}
                value={regeneratePassword}
                onChange={(e) => setRegeneratePassword(e.target.value)}
                disabled={isLoading}
                className="block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => setShowRegeneratePassword(!showRegeneratePassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
                aria-label={showRegeneratePassword ? "Hide password" : "Show password"}
              >
                {showRegeneratePassword ? (
                  <HiEyeSlash className="size-5" />
                ) : (
                  <HiEye className="size-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="regenerateCode" className="block text-sm font-medium text-gray-700">
              Authenticator Code
            </label>
            <input
              id="regenerateCode"
              type="text"
              inputMode="numeric"
              value={regenerateCode}
              onChange={(e) => setRegenerateCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              disabled={isLoading}
              maxLength={6}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 text-center font-mono tracking-widest shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-gray-100"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowRegenerateForm(false)
                setRegeneratePassword("")
                setRegenerateCode("")
              }}
              disabled={isLoading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !regeneratePassword || regenerateCode.length !== 6}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Generating..." : "Generate Codes"}
            </button>
          </div>
        </form>
      )}

      {/* Disable 2FA */}
      {!showDisableForm ? (
        <button
          onClick={() => setShowDisableForm(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700"
        >
          <HiShieldExclamation className="size-4" />
          Disable two-factor authentication
        </button>
      ) : (
        <form
          onSubmit={handleDisable2FA}
          className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <h4 className="font-medium text-red-900">Disable Two-Factor Authentication</h4>
          <p className="text-sm text-red-700">
            This will make your account less secure. Enter your password and a verification code to
            confirm.
          </p>

          <div>
            <label htmlFor="disablePassword" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="disablePassword"
                type={showDisablePassword ? "text" : "password"}
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                disabled={isLoading}
                className="block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => setShowDisablePassword(!showDisablePassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
                aria-label={showDisablePassword ? "Hide password" : "Show password"}
              >
                {showDisablePassword ? (
                  <HiEyeSlash className="size-5" />
                ) : (
                  <HiEye className="size-5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="disableCode" className="block text-sm font-medium text-gray-700">
              Authenticator Code or Backup Code
            </label>
            <input
              id="disableCode"
              type="text"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.toUpperCase())}
              placeholder="000000 or XXXX-XXXX"
              disabled={isLoading}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 text-center font-mono tracking-widest shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-gray-100"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowDisableForm(false)
                setDisablePassword("")
                setDisableCode("")
              }}
              disabled={isLoading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !disablePassword || !disableCode}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Disabling..." : "Disable 2FA"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
