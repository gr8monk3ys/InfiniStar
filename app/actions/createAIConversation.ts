"use server"

import {
  getDefaultPersonality,
  getPersonality,
  type PersonalityType,
} from "@/app/lib/ai-personalities"
import prisma from "@/app/lib/prismadb"

import getCurrentUser from "./getCurrentUser"

export default async function createAIConversation(
  aiModel?: string,
  personality?: PersonalityType,
  customPrompt?: string
) {
  const currentUser = await getCurrentUser()

  if (!currentUser?.id || !currentUser?.email) {
    return null
  }

  try {
    const personalityType = personality || getDefaultPersonality()
    const personalityConfig = getPersonality(personalityType)

    const newConversation = await prisma.conversation.create({
      data: {
        isAI: true,
        aiModel: aiModel || "claude-3-5-sonnet-20241022",
        aiPersonality: personalityType,
        aiSystemPrompt: personalityType === "custom" ? customPrompt : null,
        name: personalityConfig.name,
        users: {
          connect: {
            id: currentUser.id,
          },
        },
      },
      include: {
        users: true,
        messages: true,
      },
    })

    return newConversation
  } catch (error) {
    console.error("Error creating AI conversation:", error instanceof Error ? error.message : error)
    return null
  }
}
