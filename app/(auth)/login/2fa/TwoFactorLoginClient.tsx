"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "react-hot-toast"
import { HiArrowLeft, HiKey, HiShieldCheck } from "react-icons/hi2"

const TwoFactorLoginClient = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState<string[]>(Array(6).fill(""))
  const [isLoading, setIsLoading] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [backupCode, setBackupCode] = useState("")
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const email = searchParams.get("email")
  const token = searchParams.get("token")
  const returnUrl = searchParams.get("returnUrl") || "/dashboard"

  // Redirect if missing required params
  useEffect(() => {
    if (!email || !token) {
      toast.error("Invalid authentication session")
      router.push("/login")
    }
  }, [email, token, router])

  // Auto-focus first input
  useEffect(() => {
    if (!useBackupCode) {
      inputRefs.current[0]?.focus()
    }
  }, [useBackupCode])

  const handleCodeChange = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      if (value && !/^\d$/.test(value)) return

      const newCode = [...code]
      newCode[index] = value
      setCode(newCode)

      // Auto-advance to next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    },
    [code]
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !code[index] && index > 0) {
        // Move to previous input on backspace if current is empty
        inputRefs.current[index - 1]?.focus()
      } else if (e.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus()
      } else if (e.key === "ArrowRight" && index < 5) {
        inputRefs.current[index + 1]?.focus()
      }
    },
    [code]
  )

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").trim()

    // Handle 6-digit code paste
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("")
      setCode(digits)
      inputRefs.current[5]?.focus()
    }
  }, [])

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()

      const verificationCode = useBackupCode ? backupCode : code.join("")

      if (!useBackupCode && verificationCode.length !== 6) {
        toast.error("Please enter all 6 digits")
        return
      }

      if (useBackupCode && !backupCode.trim()) {
        toast.error("Please enter a backup code")
        return
      }

      if (!email || !token) {
        toast.error("Invalid authentication session")
        router.push("/login")
        return
      }

      setIsLoading(true)

      try {
        // Complete the login with the 2FA code
        const result = await signIn("credentials", {
          email,
          password: token, // The token serves as proof of password verification
          twoFactorCode: verificationCode,
          redirect: false,
        })

        if (result?.error) {
          if (result.error.includes("Invalid two-factor")) {
            toast.error("Invalid verification code. Please try again.")
          } else {
            toast.error(result.error)
          }
          setIsLoading(false)
          return
        }

        if (result?.ok) {
          toast.success("Successfully logged in!")
          router.push(returnUrl)
        }
      } catch {
        toast.error("An error occurred. Please try again.")
        setIsLoading(false)
      }
    },
    [code, backupCode, useBackupCode, email, token, router, returnUrl]
  )

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (!useBackupCode && code.every((digit) => digit !== "")) {
      handleSubmit()
    }
  }, [code, useBackupCode, handleSubmit])

  if (!email || !token) {
    return null
  }

  return (
    <div className="flex min-h-full flex-col justify-center bg-gray-100 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-sky-100">
            <HiShieldCheck className="size-10 text-sky-600" />
          </div>
        </div>
        <h1 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Two-Factor Authentication
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          {useBackupCode
            ? "Enter one of your backup codes"
            : "Enter the 6-digit code from your authenticator app"}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <form
            onSubmit={handleSubmit}
            className="space-y-6"
            aria-label="Two-factor authentication form"
          >
            {!useBackupCode ? (
              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700">
                  Verification Code
                </label>
                <div
                  className="flex justify-center gap-2"
                  onPaste={handlePaste}
                  role="group"
                  aria-label="6-digit verification code"
                >
                  {/* eslint-disable react/no-array-index-key -- Fixed position PIN digit inputs */}
                  {code.map((digit, index) => (
                    <input
                      key={`digit-${index}`}
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
              </div>
            ) : (
              <div>
                <label htmlFor="backupCode" className="block text-sm font-medium text-gray-700">
                  Backup Code
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <HiKey className="size-5 text-gray-400" />
                  </div>
                  <input
                    id="backupCode"
                    type="text"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                    disabled={isLoading}
                    placeholder="XXXX-XXXX"
                    className="block w-full rounded-md border border-gray-300 py-3 pl-10 pr-3 text-center font-mono text-lg tracking-widest shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-gray-100"
                    aria-required="true"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Backup codes are 8 characters. The dash is optional.
                </p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className="flex w-full justify-center rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Verify"}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode)
                  setCode(Array(6).fill(""))
                  setBackupCode("")
                }}
                className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {useBackupCode ? (
                  <>
                    <HiShieldCheck className="size-4" />
                    Use authenticator app
                  </>
                ) : (
                  <>
                    <HiKey className="size-4" />
                    Use a backup code
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <HiArrowLeft className="size-4" />
                Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TwoFactorLoginClient
