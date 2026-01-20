import getConversations from "@/app/actions/getConversations"
import getUsers from "@/app/actions/getUsers"

import GlobalSearchProvider from "../components/GlobalSearchProvider"
import KeyboardShortcutsProvider from "../components/KeyboardShortcutsProvider"
import PresenceProvider from "../components/PresenceProvider"
import Sidebar from "../components/sidebar/Sidebar"
import ConversationList from "./components/ConversationList"

export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const conversations = await getConversations()
  const user = await getUsers()

  return (
    // @ts-expect-error Server Component
    <Sidebar>
      <GlobalSearchProvider>
        <KeyboardShortcutsProvider>
          <PresenceProvider>
            <div className="h-full">
              <ConversationList user={user} title="Messages" initialItems={conversations} />
              {children}
            </div>
          </PresenceProvider>
        </KeyboardShortcutsProvider>
      </GlobalSearchProvider>
    </Sidebar>
  )
}
