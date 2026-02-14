"use server"

import { getModelForUser } from "@/app/lib/ai-model-routing"
import {
  getDefaultPersonality,
  getPersonality,
  type PersonalityType,
} from "@/app/lib/ai-personalities"
import prisma from "@/app/lib/prismadb"
import { getUserSubscriptionPlan } from "@/app/lib/subscription"

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
    const subscriptionPlan = await getUserSubscriptionPlan(currentUser.id).catch(() => null)
    const routedModel = getModelForUser({
      isPro: subscriptionPlan?.isPro ?? false,
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
