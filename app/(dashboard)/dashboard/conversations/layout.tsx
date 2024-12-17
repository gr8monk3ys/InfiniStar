import getConversations from "../actions/getConversations";
import getuser from "../actions/getUsers";
import Sidebar from "../components/sidebar/Sidebar";
import ConversationList from "./components/ConversationList";

export default async function ConversationsLayout({
  children
}: {
  children: React.ReactNode,
}) {
  const conversations = await getConversations();
  const user = await getuser();

  return (
    // @ts-expect-error Server Component
    <Sidebar>
      <div className="h-full">
        <ConversationList 
          user={user} 
          title="Messages" 
          initialItems={conversations}
        />
        {children}
      </div>
    </Sidebar>
  );
}
