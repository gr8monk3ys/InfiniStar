"use client"

import { useEffect, useState } from "react"

import { api } from "@/app/lib/api-client"

import { TwoFactorBackupCodes } from "./two-factor/TwoFactorBackupCodes"
import { TwoFactorEnabled } from "./two-factor/TwoFactorEnabled"
import { TwoFactorIdle } from "./two-factor/TwoFactorIdle"
import { TwoFactorSetup } from "./two-factor/TwoFactorSetup"

interface TwoFactorSettingsProps {
  initialEnabled?: boolean
  hasPassword: boolean
}

type Step = "idle" | "setup" | "backup-codes" | "enabled"

interface SetupData {
  secret: string
  qrCode: string
}

export function TwoFactorSettings({ initialEnabled = false, hasPassword }: TwoFactorSettingsProps) {
  const [step, setStep] = useState<Step>(initialEnabled ? "enabled" : "idle")
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [remainingBackupCodes, setRemainingBackupCodes] = useState<number | null>(null)

  // Fetch live 2FA status and remaining backup code count on mount
  useEffect(() => {
    const fetch2FAStatus = async () => {
      try {
        const response = await api.get<{ twoFactorEnabled: boolean }>("/api/profile", {
          showErrorToast: false,
        })
        const enabled = response.twoFactorEnabled ?? false
        setStep(enabled ? "enabled" : "idle")

        if (enabled) {
          const backupResponse = await api.get<{ remainingCodes: number }>(
            "/api/auth/2fa/backup-codes",
            { showErrorToast: false }
          )
          setRemainingBackupCodes(backupResponse.remainingCodes)
        }
      } catch {
        // Ignore errors — fall back to initialEnabled prop value
      }
    }
    fetch2FAStatus()
  }, [])

  if (step === "idle") {
    return (
      <TwoFactorIdle
        hasPassword={hasPassword}
        onSetupStarted={(data) => {
          setSetupData(data)
          setStep("setup")
        }}
      />
    )
  }

  if (step === "setup" && setupData) {
    return (
      <TwoFactorSetup
        setupData={setupData}
        onVerified={(codes) => {
          setBackupCodes(codes)
          setRemainingBackupCodes(codes.length)
          setStep("backup-codes")
        }}
        onCancel={() => {
          setSetupData(null)
          setStep("idle")
        }}
      />
    )
  }

  if (step === "backup-codes" && backupCodes.length > 0) {
    return (
      <TwoFactorBackupCodes
        backupCodes={backupCodes}
        onDone={() => {
          setBackupCodes([])
          setSetupData(null)
          setStep("enabled")
        }}
      />
    )
  }

  // step === "enabled"
  return (
    <TwoFactorEnabled
      remainingBackupCodes={remainingBackupCodes}
      onDisabled={() => {
        setRemainingBackupCodes(null)
        setStep("idle")
      }}
      onBackupCodesRegenerated={(codes) => {
        setBackupCodes(codes)
        setRemainingBackupCodes(codes.length)
        setStep("backup-codes")
      }}
    />
  )
}
