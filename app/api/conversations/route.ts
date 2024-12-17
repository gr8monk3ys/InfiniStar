import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/app/libs/prismadb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const currentUser = session?.user;
    const body = await request.json();
    const { userId, isGroup, members, name } = body;

    if (!currentUser?.id || !currentUser?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (isGroup && (!members || members.length < 2)) {
      return new NextResponse('Invalid data', { status: 400 });
    }

    if (isGroup) {
      const newConversation = await prisma.conversation.create({
        data: {
          title: name,
          userId: currentUser.id,
          user: {
            connect: members.map((id: string) => ({
              id
            }))
          }
        },
        include: {
          user: true,
          messages: {
            include: {
              sender: true,
              seen: true
            }
          }
        }
      });

      return NextResponse.json(newConversation);
    }

    const existingConversations = await prisma.conversation.findMany({
      where: {
        userId: currentUser.id,
        AND: [
          {
            user: {
              some: {
                id: userId
              }
            }
          }
        ]
      }
    });

    const singleConversation = existingConversations[0];

    if (singleConversation) {
      return NextResponse.json(singleConversation);
    }

    const newConversation = await prisma.conversation.create({
      data: {
        userId: currentUser.id,
        user: {
          connect: [
            {
              id: userId
            }
          ]
        }
      },
      include: {
        user: true,
        messages: {
          include: {
            sender: true,
            seen: true
          }
        }
      }
    });

    return NextResponse.json(newConversation);
  } catch (error) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}