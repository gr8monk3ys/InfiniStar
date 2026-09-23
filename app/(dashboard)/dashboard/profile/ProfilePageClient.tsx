"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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

const TAB_IDS: TabType[] = [
  "profile",
  "password",
  "security",
  "safety",
  "notifications",
  "sessions",
  "appearance",
  "memory",
  "auto-delete",
  "account",
]

function isTabType(value: string): value is TabType {
  return (TAB_IDS as string[]).includes(value)
}

// Static, so built once at module scope instead of on every render.
const TABS: { id: TabType; label: string; icon: React.ReactNode; isDestructive?: boolean }[] = [
  { id: "profile", label: "Profile Information", icon: <HiUser size={20} aria-hidden="true" /> },
  { id: "password", label: "Change Password", icon: <HiLockClosed size={20} aria-hidden="true" /> },
  { id: "security", label: "Security", icon: <HiShieldCheck size={20} aria-hidden="true" /> },
  {
    id: "safety",
    label: "Safety & Content",
    icon: <HiShieldExclamation size={20} aria-hidden="true" />,
  },
  { id: "notifications", label: "Notifications", icon: <HiBell size={20} aria-hidden="true" /> },
  { id: "sessions", label: "Sessions", icon: <HiComputerDesktop size={20} aria-hidden="true" /> },
  { id: "appearance", label: "Appearance", icon: <HiPaintBrush size={20} aria-hidden="true" /> },
  { id: "memory", label: "AI Memory", icon: <HiSparkles size={20} aria-hidden="true" /> },
  { id: "auto-delete", label: "Auto-Delete", icon: <HiClock size={20} aria-hidden="true" /> },
  {
    id: "account",
    label: "Delete Account",
    icon: <HiTrash size={20} aria-hidden="true" />,
    isDestructive: true,
  },
]

export default function ProfilePageClient({ hasPendingDeletion }: { hasPendingDeletion: boolean }) {
  // The active tab lives in the URL (?tab=…) so it survives reloads and can be
  // deep-linked. It is derived from the search params on every render.
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const activeTab: TabType = requestedTab && isTabType(requestedTab) ? requestedTab : "profile"

  const selectTab = (tab: TabType) => {
    const params = new URLSearchParams(window.location.search)
    if (tab === "profile") {
      params.delete("tab")
    } else {
      params.set("tab", tab)
    }
    const query = params.toString()
    // Native replaceState integrates with the App Router (useSearchParams updates)
    // without a server round trip for this dynamic page.
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="border-b bg-background">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Back to dashboard"
            >
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="rounded-lg bg-card shadow">
          <div className="border-b border-border">
            <nav className="-mb-px flex gap-8 overflow-x-auto px-6" aria-label="Profile tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  aria-current={activeTab === tab.id ? "true" : undefined}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                    activeTab === tab.id
                      ? tab.isDestructive
                        ? "border-red-500 text-red-600"
                        : "border-primary text-primary-accent"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === "account" && (
                    <AccountTabBadge deletionRequested={hasPendingDeletion} />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "profile" && <ProfileTabContent />}
            {activeTab === "password" && <PasswordTabContent />}
            {activeTab === "security" && <SecurityTabContent />}
            {activeTab === "safety" && <SafetyTabContent />}
            {activeTab === "notifications" && <NotificationsTabContent />}

            {activeTab === "sessions" && (
              <section className="space-y-4" aria-label="Session management section">
                <div>
                  <h2 className="text-lg font-medium text-foreground">Active Sessions</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage devices where you are currently logged in. Revoke access to any session
                    you do not recognize.
                  </p>
                </div>
                <SessionsList />
              </section>
            )}

            {activeTab === "appearance" && (
              <section className="space-y-8" aria-label="Appearance settings section">
                <div>
                  <h2 className="text-lg font-medium text-foreground">Appearance</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Customize how <span translate="no">InfiniStar</span> looks. Choose a preset
                    theme or create your own custom appearance.
                  </p>
                </div>

                <section>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Color Mode
                  </h3>
                  <div className="rounded-lg border border-border bg-muted p-4">
                    <DarkModeToggle />
                  </div>
                </section>

                <div className="border-t border-border" />
                <ThemeSelector />
                <div className="border-t border-border" />
                <ThemeCustomizer />
              </section>
            )}

            {activeTab === "memory" && (
              <section className="space-y-4" aria-label="AI memory settings section">
                <MemoryManager />
              </section>
            )}

            {activeTab === "auto-delete" && (
              <section className="space-y-4" aria-label="Auto-delete settings section">
                <AutoDeleteSettings />
              </section>
            )}

            {activeTab === "account" && <AccountTabContent />}
          </div>
        </div>
      </div>
    </div>
  )
}
