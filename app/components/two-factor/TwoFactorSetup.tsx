"use client"

import { useCallback, useRef, useState } from "react"
import Image from "next/image"
import { toast } from "react-hot-toast"
import { HiDocumentDuplicate, HiEye, HiEyeSlash } from "react-icons/hi2"

import { api, ApiError, createLoadingToast } from "@/app/lib/api-client"

interface SetupData {
  secret: string
  qrCode: string
}

interface TwoFactorSetupProps {
  setupData: SetupData
  onVerified: (backupCodes: string[]) => void
  onCancel: () => void
}

export function TwoFactorSetup({ setupData, onVerified, onCancel }: TwoFactorSetupProps) {
  const [phase, setPhase] = useState<"scanning" | "verifying">("scanning")
  const [showSecret, setShowSecret] = useState(false)
  const [verificationCode, setVerificationCode] = useState<string[]>(Array(6).fill(""))
  const [isLoading, setIsLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

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
        { code },
        { showErrorToast: false }
      )

      loader.success("Two-factor authentication enabled!")
      onVerified(response.backupCodes)
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to verify code"
      loader.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [verificationCode, onVerified])

  // --- Scanning phase ---
  if (phase === "scanning") {
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
          <button onClick={onCancel} className="text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={() => {
              setPhase("verifying")
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

  // --- Verifying phase ---
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
          onClick={() => setPhase("scanning")}
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
