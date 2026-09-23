"use client"

import { useState } from "react"
import { Calendar, Hash, Users } from "lucide-react"

import { cn } from "@/app/lib/utils"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { Input } from "@/app/components/ui/simple-input"

export type ShareType = "LINK" | "INVITE"
export type SharePermission = "VIEW" | "PARTICIPATE"

const pad2 = (value: number) => String(value).padStart(2, "0")

/**
 * `YYYY-MM-DDTHH:mm` in the viewer's time zone, the value format of
 * `<input type="datetime-local">`. (`toISOString()` is UTC, which shifts the
 * shown time by the viewer's offset.)
 */
export function toDateTimeLocalValue(date: Date): string {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  )
}

export interface ShareSettingsData {
  shareType: ShareType
  permission: SharePermission
  expiresAt: string | null
  maxUses: number | null
  name: string
}

interface ShareSettingsProps {
  settings: ShareSettingsData
  onChange: (settings: ShareSettingsData) => void
  className?: string
}

export function ShareSettings({ settings, onChange, className }: ShareSettingsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleChange = (key: keyof ShareSettingsData, value: unknown) => {
    onChange({
      ...settings,
      [key]: value,
    })
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Share Name (optional) */}
      <div className="space-y-2">
        <Label htmlFor="share-name">Share Name (optional)</Label>
        <Input
          id="share-name"
          name="shareName"
          autoComplete="off"
          placeholder="e.g., Team meeting notes…"
          value={settings.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("name", e.target.value)
          }
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">A name to help you identify this share link</p>
      </div>

      {/* Share Type */}
      <div className="space-y-2">
        <Label htmlFor="share-type">Share Type</Label>
        <Select
          value={settings.shareType}
          onValueChange={(value: ShareType) => handleChange("shareType", value)}
        >
          <SelectTrigger id="share-type">
            <SelectValue placeholder="Select share type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LINK">
              <div className="flex items-center gap-2">
                <Users className="size-4" aria-hidden="true" />
                <span>Anyone with link</span>
              </div>
            </SelectItem>
            <SelectItem value="INVITE">
              <div className="flex items-center gap-2">
                <Users className="size-4" aria-hidden="true" />
                <span>Invite only</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {settings.shareType === "LINK"
            ? "Anyone with the link can join"
            : "Only invited email addresses can join"}
        </p>
      </div>

      {/* Permission Level */}
      <div className="space-y-2">
        <Label htmlFor="share-permission">Permission Level</Label>
        <Select
          value={settings.permission}
          onValueChange={(value: SharePermission) => handleChange("permission", value)}
        >
          <SelectTrigger id="share-permission">
            <SelectValue placeholder="Select permission" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="VIEW">View only (read-only)</SelectItem>
            <SelectItem value="PARTICIPATE">Participate (can send messages)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {settings.permission === "VIEW"
            ? "Users can only read messages"
            : "Users can read and send messages"}
        </p>
      </div>

      {/* Advanced Settings Toggle */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setShowAdvanced((shown) => !shown)}
        aria-expanded={showAdvanced}
        className="w-full justify-start text-muted-foreground"
      >
        {showAdvanced ? "Hide" : "Show"} Advanced Settings
      </Button>

      {showAdvanced && (
        <div className="space-y-4 rounded-md border p-4">
          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expires-at" className="flex items-center gap-2">
              <Calendar className="size-4" aria-hidden="true" />
              Expiration Date
            </Label>
            <Input
              id="expires-at"
              name="expiresAt"
              autoComplete="off"
              type="datetime-local"
              value={settings.expiresAt || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange("expiresAt", e.target.value || null)
              }
              min={toDateTimeLocalValue(new Date())}
            />
            <p className="text-xs text-muted-foreground">Leave empty for no expiration</p>
          </div>

          {/* Max Uses */}
          <div className="space-y-2">
            <Label htmlFor="max-uses" className="flex items-center gap-2">
              <Hash className="size-4" aria-hidden="true" />
              Maximum Uses
            </Label>
            <Input
              id="max-uses"
              name="maxUses"
              autoComplete="off"
              type="number"
              inputMode="numeric"
              placeholder="Unlimited"
              value={settings.maxUses || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange("maxUses", e.target.value ? parseInt(e.target.value, 10) : null)
              }
              min={1}
            />
            <p className="text-xs text-muted-foreground">Leave empty for unlimited uses</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShareSettings
