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

const CODE_LENGTH = 6
const SINGLE_DIGIT = /^\d$/
const FULL_CODE = /^\d{6}$/

function createEmptyCode(): string[] {
  return Array<string>(CODE_LENGTH).fill("")
}

export function TwoFactorSetup({ setupData, onVerified, onCancel }: TwoFactorSetupProps) {
  const [phase, setPhase] = useState<"scanning" | "verifying">("scanning")
  const [showSecret, setShowSecret] = useState(false)
  const [verificationCode, setVerificationCode] = useState<string[]>(createEmptyCode)
  const [isLoading, setIsLoading] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleCodeChange = useCallback((index: number, value: string) => {
    if (value && !SINGLE_DIGIT.test(value)) return

    setVerificationCode((current) => current.with(index, value))

    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [])

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

  // Only take over the paste when it is a whole code; anything else falls
  // through to the input's own paste handling instead of being swallowed.
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pastedData = e.clipboardData.getData("text").trim()
    if (FULL_CODE.test(pastedData)) {
      e.preventDefault()
      setVerificationCode(pastedData.split(""))
      inputRefs.current[CODE_LENGTH - 1]?.focus()
    }
  }, [])

  const handleVerifySetup = useCallback(async () => {
    const code = verificationCode.join("")
    if (code.length !== CODE_LENGTH) {
      toast.error("Please enter all 6 digits")
      return
    }

    setIsLoading(true)
    const loader = createLoadingToast("Verifying code…")

    try {
      const response = await api.post<{ backupCodes: string[] }>(
        "/api/auth/2fa/verify",
        { code },
        { showErrorToast: false }
      )

      loader.success("Two-factor authentication enabled!")
      onVerified(response.backupCodes)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Couldn't verify the code. Check your connection and try again."
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
          <h3 className="text-lg font-semibold text-foreground">Scan QR Code</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Open your authenticator app and scan this QR code
          </p>
        </div>

        <div className="flex justify-center">
          <div className="rounded-lg border-2 border-border bg-white p-4">
            <Image
              src={setupData.qrCode}
              alt="QR Code for authenticator app"
              width={200}
              height={200}
              className="rounded"
            />
          </div>
        </div>

        <div className="rounded-lg bg-muted p-4">
          <p className="mb-2 text-sm font-medium text-foreground">
            Cannot scan the code? Enter this key manually:
          </p>
          <div className="flex items-center gap-2">
            <code
              translate="no"
              className="min-w-0 flex-1 break-all rounded bg-background px-3 py-2 font-mono text-sm text-foreground"
            >
              {showSecret ? setupData.secret : "••••••••••••••••"}
            </code>
            <button
              type="button"
              onClick={() => setShowSecret((current) => !current)}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label={showSecret ? "Hide secret key" : "Show secret key"}
            >
              {showSecret ? (
                <HiEyeSlash className="size-5" aria-hidden="true" />
              ) : (
                <HiEye className="size-5" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(setupData.secret).then(
                  () => toast.success("Secret key copied"),
                  () => toast.error("Couldn't copy the key. Show it and type it in manually.")
                )
              }}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Copy secret key"
            >
              <HiDocumentDuplicate className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setPhase("verifying")
              setTimeout(() => inputRefs.current[0]?.focus(), 100)
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Continue to Verification
          </button>
        </div>
      </div>
    )
  }

  // --- Verifying phase ---
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">Verify Setup</h3>
        <p className="mt-1 text-sm text-muted-foreground">
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
            name={`code-digit-${index + 1}`}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            onChange={(e) => handleCodeChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={isLoading}
            className="size-12 rounded-lg border-2 border-input bg-background text-center text-xl font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-muted"
            aria-label={`Digit ${index + 1}`}
          />
        ))}
        {/* eslint-enable react/no-array-index-key */}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setPhase("scanning")}
          disabled={isLoading}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleVerifySetup}
          disabled={isLoading || verificationCode.some((d) => !d)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Verifying…" : "Verify Code"}
        </button>
      </div>
    </div>
  )
}
