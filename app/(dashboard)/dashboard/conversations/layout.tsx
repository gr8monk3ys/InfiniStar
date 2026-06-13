import { isGroupChatEnabled } from "@/app/lib/features"
import getConversations from "@/app/actions/getConversations"
import getCurrentUser from "@/app/actions/getCurrentUser"
import getPopularSceneCharacters from "@/app/actions/getPopularSceneCharacters"
import getUsers from "@/app/actions/getUsers"

import GlobalSearchProvider from "../components/GlobalSearchProvider"
import KeyboardShortcutsProvider from "../components/KeyboardShortcutsProvider"
import PresenceProvider from "../components/PresenceProvider"
import Sidebar from "../components/sidebar/Sidebar"
import ConversationList from "./components/ConversationList"
import type { NotificationPreferences } from "./types"

export const dynamic = "force-dynamic"

export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  // Only fetch the user directory when group chat is enabled — otherwise we'd be
  // shipping every account's name/email/avatar to the client to populate a picker
  // that is never shown.
  const [conversations, user, currentUser] = await Promise.all([
    getConversations(),
    isGroupChatEnabled() ? getUsers().then((r) => r.users) : Promise.resolve([]),
    getCurrentUser(),
  ])
  const sceneCharacters = await getPopularSceneCharacters(currentUser)
  const initialNotificationPrefs: NotificationPreferences | null = currentUser
    ? {
        browserNotifications: currentUser.browserNotifications ?? false,
        notifyOnNewMessage: currentUser.notifyOnNewMessage ?? true,
        notifyOnAIComplete: currentUser.notifyOnAIComplete ?? true,
        mutedConversations: currentUser.mutedConversations ?? [],
      }
    : null

  return (
    <GlobalSearchProvider>
      <KeyboardShortcutsProvider>
        <PresenceProvider>
          <Sidebar>
            <div className="h-full">
              <ConversationList
                user={user}
                title="Messages"
                initialItems={conversations}
                currentUserId={currentUser?.id ?? null}
                initialNotificationPrefs={initialNotificationPrefs}
                sceneCharacters={sceneCharacters}
              />
              {children}
            </div>
          </Sidebar>
        </PresenceProvider>
      </KeyboardShortcutsProvider>
    </GlobalSearchProvider>
  )
}
