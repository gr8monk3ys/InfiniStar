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
          placeholder="e.g., Team meeting notes"
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
        <Label>Share Type</Label>
        <Select
          value={settings.shareType}
          onValueChange={(value: ShareType) => handleChange("shareType", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select share type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LINK">
              <div className="flex items-center gap-2">
                <Users className="size-4" />
                <span>Anyone with link</span>
              </div>
            </SelectItem>
            <SelectItem value="INVITE">
              <div className="flex items-center gap-2">
                <Users className="size-4" />
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
        <Label>Permission Level</Label>
        <Select
          value={settings.permission}
          onValueChange={(value: SharePermission) => handleChange("permission", value)}
        >
          <SelectTrigger>
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
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full justify-start text-muted-foreground"
      >
        {showAdvanced ? "Hide" : "Show"} advanced settings
      </Button>

      {showAdvanced && (
        <div className="space-y-4 rounded-md border p-4">
          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="expires-at" className="flex items-center gap-2">
              <Calendar className="size-4" />
              Expiration Date
            </Label>
            <Input
              id="expires-at"
              type="datetime-local"
              value={settings.expiresAt || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleChange("expiresAt", e.target.value || null)
              }
              min={new Date().toISOString().slice(0, 16)}
            />
            <p className="text-xs text-muted-foreground">Leave empty for no expiration</p>
          </div>

          {/* Max Uses */}
          <div className="space-y-2">
            <Label htmlFor="max-uses" className="flex items-center gap-2">
              <Hash className="size-4" />
              Maximum Uses
            </Label>
            <Input
              id="max-uses"
              type="number"
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
