import { getServerSession } from "next-auth";
import prisma from "@/app/libs/prismadb";

const getConversations = async () => {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return [];
  }

  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        user: {
          email: session.user.email
        }
      },
      include: {
        messages: {
          include: {
            sender: true,
            seen: true,
          }
        },
        user: true
      }
    });

    return conversations;
  } catch (error: any) {
    return [];
  }
};

export default getConversations;
