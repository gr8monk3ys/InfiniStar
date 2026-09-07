"use server"

import { getModelForUser } from "@/app/lib/ai-model-routing"
import {
  getDefaultPersonality,
  getPersonality,
  type PersonalityType,
} from "@/app/lib/ai-personalities"
import { PARTICIPANT_SELECT } from "@/app/lib/conversation-select"
import { aiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { isProSubscription } from "@/app/lib/subscription"

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
    const isPro = isProSubscription(currentUser)
    const routedModel = getModelForUser({
      isPro,
      requestedModelId: aiModel,
    })

    const newConversation = await prisma.conversation.create({
      data: {
        isAI: true,
        aiModel: routedModel,
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
        users: { select: PARTICIPANT_SELECT },
        messages: true,
      },
    })

    return newConversation
  } catch (error) {
    aiLogger.error({ err: error }, "Error creating AI conversation")
    return null
  }
}
