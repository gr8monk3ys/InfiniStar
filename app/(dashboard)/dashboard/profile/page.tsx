"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import {
  HiBell,
  HiClock,
  HiComputerDesktop,
  HiLockClosed,
  HiPaintBrush,
  HiShieldCheck,
  HiShieldExclamation,
  HiSparkles,
  HiTrash,
  HiUser,
} from "react-icons/hi2"

import { DarkModeToggle, ThemeCustomizer, ThemeSelector } from "@/app/components/themes"

import {
  AccountTabBadge,
  AccountTabContent,
  NotificationsTabContent,
  PasswordTabContent,
  ProfileTabContent,
  SafetyTabContent,
  SecurityTabContent,
} from "./components"

// Lazy-load heavy components that are only shown when the matching tab is active
const SessionsList = dynamic(() => import("@/app/components/SessionsList"), {
  loading: () => <div className="h-48 animate-pulse rounded-lg bg-muted" />,
  ssr: false,
})

const AutoDeleteSettings = dynamic(
  () => import("@/app/components/settings").then((mod) => ({ default: mod.AutoDeleteSettings })),
  {
    loading: () => <div className="h-48 animate-pulse rounded-lg bg-muted" />,
    ssr: false,
  }
)

const MemoryManager = dynamic(() => import("@/app/components/ai-memory/MemoryManager"), {
  loading: () => <div className="h-48 animate-pulse rounded-lg bg-muted" />,
  ssr: false,
})

type TabType =
  | "profile"
  | "password"
  | "security"
  | "safety"
  | "notifications"
  | "sessions"
  | "appearance"
  | "memory"
  | "auto-delete"
  | "account"

export default function ProfilePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("profile")

  const tabs: { id: TabType; label: string; icon: React.ReactNode; isDestructive?: boolean }[] = [
    { id: "profile", label: "Profile Information", icon: <HiUser size={20} /> },
    { id: "password", label: "Change Password", icon: <HiLockClosed size={20} /> },
    { id: "security", label: "Security", icon: <HiShieldCheck size={20} /> },
    { id: "safety", label: "Safety & Content", icon: <HiShieldExclamation size={20} /> },
    { id: "notifications", label: "Notifications", icon: <HiBell size={20} /> },
    { id: "sessions", label: "Sessions", icon: <HiComputerDesktop size={20} /> },
    { id: "appearance", label: "Appearance", icon: <HiPaintBrush size={20} /> },
    { id: "memory", label: "AI Memory", icon: <HiSparkles size={20} /> },
    { id: "auto-delete", label: "Auto-Delete", icon: <HiClock size={20} /> },
    { id: "account", label: "Delete Account", icon: <HiTrash size={20} />, isDestructive: true },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to dashboard"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="rounded-lg bg-card shadow">
          {/* Tabs */}
          <div className="border-b border-border">
            <nav className="-mb-px flex gap-8 px-6" aria-label="Profile tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium ${
                    activeTab === tab.id
                      ? tab.isDestructive
                        ? "border-red-500 text-red-600"
                        : "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === "account" && <AccountTabBadge />}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "profile" && <ProfileTabContent />}

            {activeTab === "password" && <PasswordTabContent />}

            {activeTab === "security" && <SecurityTabContent />}

            {activeTab === "safety" && <SafetyTabContent />}

            {activeTab === "notifications" && <NotificationsTabContent />}

            {activeTab === "sessions" && (
              <div className="space-y-4" aria-label="Session management section">
                <div>
                  <h3 className="text-lg font-medium text-foreground">Active Sessions</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage devices where you are currently logged in. Revoke access to any session
                    you do not recognize.
                  </p>
                </div>
                <SessionsList />
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-8" aria-label="Appearance settings section">
                <div>
                  <h3 className="text-lg font-medium text-foreground">Appearance</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Customize how InfiniStar looks. Choose a preset theme or create your own custom
                    appearance.
                  </p>
                </div>

                <section>
                  <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Color Mode
                  </h4>
                  <div className="rounded-lg border border-border bg-muted p-4">
                    <DarkModeToggle />
                  </div>
                </section>

                <div className="border-t border-border" />
                <ThemeSelector />
                <div className="border-t border-border" />
                <ThemeCustomizer />
              </div>
            )}

            {activeTab === "memory" && (
              <div className="space-y-4" aria-label="AI memory settings section">
                <MemoryManager />
              </div>
            )}

            {activeTab === "auto-delete" && (
              <div className="space-y-4" aria-label="Auto-delete settings section">
                <AutoDeleteSettings />
              </div>
            )}

            {activeTab === "account" && <AccountTabContent />}
          </div>
        </div>
      </div>
    </div>
  )
}
