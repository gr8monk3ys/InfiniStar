"use server"

import { z } from "zod"

import { getModelForUser } from "@/app/lib/ai-model-routing"
import {
  getDefaultPersonality,
  getPersonality,
  isValidPersonality,
  type PersonalityType,
} from "@/app/lib/ai-personalities"
import { PARTICIPANT_SELECT } from "@/app/lib/conversation-select"
import { aiLogger } from "@/app/lib/logger"
import prisma from "@/app/lib/prismadb"
import { isProSubscription } from "@/app/lib/subscription"

import getCurrentUser from "./getCurrentUser"

/**
 * A Server Action is a public endpoint: its arguments arrive from the network,
 * not from the typed modal that normally calls it, so they are checked here.
 * The custom prompt shares the bound a Character's system prompt has.
 */
const argsSchema = z.object({
  aiModel: z.string().max(100).optional(),
  personality: z
    .string()
    .refine((value) => isValidPersonality(value))
    .optional(),
  customPrompt: z.string().max(4000).optional(),
})

export default async function createAIConversation(
  aiModel?: string,
  personality?: PersonalityType,
  customPrompt?: string
) {
  const parsedArgs = argsSchema.safeParse({ aiModel, personality, customPrompt })
  if (!parsedArgs.success) {
    return null
  }

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
