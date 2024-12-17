import { useSession } from "next-auth/react";
import { useMemo } from "react";
import { User } from "@prisma/client";

interface ConversationWithUsers {
  users: User[];
}

const useOtherUser = (conversation: ConversationWithUsers) => {
  const session = useSession();

  const otherUser = useMemo(() => {
    const currentUserEmail = session?.data?.user?.email;
    const otherUser = conversation.users.filter(
      (user: User) => user.email !== currentUserEmail
    );

    return otherUser[0];
  }, [session?.data?.user?.email, conversation.users]);

  return otherUser;
};

export default useOtherUser;
