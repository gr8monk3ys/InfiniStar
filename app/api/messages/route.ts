import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/app/libs/prismadb";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(
  request: Request,
) {
  try {
    const session = await getServerSession(authOptions);
    const currentUser = session?.user;
    const body = await request.json();
    const {
      message,
      image,
      conversationId
    } = body;

    if (!currentUser?.id || !currentUser?.email) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const newMessage = await prisma.message.create({
      data: {
        content: message || '',
        role: 'user',
        conversationId,
        senderId: currentUser.id,
        seen: {
          connect: {
            id: currentUser.id
          }
        }
      },
      include: {
        sender: true,
        seen: true
      }
    });

    const updatedConversation = await prisma.conversation.update({
      where: {
        id: conversationId
      },
      data: {
        messages: {
          connect: {
            id: newMessage.id
          }
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

    return NextResponse.json(newMessage);
  } catch (error) {
    console.log(error, 'ERROR_MESSAGES');
    return new NextResponse('Error', { status: 500 });
  }
}