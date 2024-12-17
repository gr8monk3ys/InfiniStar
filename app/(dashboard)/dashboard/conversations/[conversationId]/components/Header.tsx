import { useMemo } from "react";
import { HiChevronLeft } from 'react-icons/hi'
import { HiEllipsisHorizontal } from 'react-icons/hi2';
import { useRouter } from "next/navigation";
import Link from "next/link";

import useOtherUser from "@/app/hooks/useOtherUser";
import useActiveList from "@/app/hooks/useActiveList";

import Avatar from "@/app/components/Avatar";
import AvatarGroup from "@/app/components/AvatarGroup";
import { Conversation, User } from "@prisma/client";

interface ExtendedConversation extends Omit<Conversation, 'createdAt' | 'lastMessageAt'> {
  users: User[];
  createdAt: Date;
  lastMessageAt: Date;
  isGroup: boolean;
  name: string | null;
}

interface HeaderProps {
  conversation: ExtendedConversation;
}

const Header: React.FC<HeaderProps> = ({ conversation }) => {
  const otherUser = useOtherUser(conversation);
  const router = useRouter();
  const { members } = useActiveList();

  const isActive = members.indexOf(otherUser?.id || '') !== -1;

  const statusText = useMemo(() => {
    if (conversation.isGroup) {
      return `${conversation.users.length} members`;
    }

    return isActive ? 'Active' : 'Offline';
  }, [conversation, isActive]);

  return (
    <div className="flex w-full items-center justify-between border-b bg-white px-4 py-3 shadow-sm sm:px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Link
          href="/conversations"
          className="block cursor-pointer text-sky-500 transition hover:text-sky-600 lg:hidden"
        >
          <HiChevronLeft size={32} />
        </Link>
        {conversation.isGroup ? (
          <AvatarGroup users={conversation.users} />
        ) : (
          <Avatar user={otherUser} />
        )}
        <div className="flex flex-col">
          <div>{conversation.name || otherUser?.name}</div>
          <div className="text-sm font-light text-neutral-500">
            {statusText}
          </div>
        </div>
      </div>
      <HiEllipsisHorizontal
        size={32}
        onClick={() => {}}
        className="cursor-pointer text-sky-500 transition hover:text-sky-600"
      />
    </div>
  );
}

export default Header;
