"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

import {
  formatCost,
  getAllModels,
  getDefaultModel,
  getModelIcon,
  type ModelType,
} from "@/app/lib/ai-models"
import { getAllPersonalities, type PersonalityType } from "@/app/lib/ai-personalities"
import Modal from "@/app/components/ui/modal"
import createAIConversation from "@/app/actions/createAIConversation"

interface PersonalitySelectionModalProps {
  isOpen: boolean
  onClose: () => void
}

const PersonalitySelectionModal: React.FC<PersonalitySelectionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter()
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityType>("assistant")
  const [selectedModel, setSelectedModel] = useState<ModelType>(getDefaultModel())
  const [customPrompt, setCustomPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const personalities = getAllPersonalities()
  const models = getAllModels()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const conversation = await createAIConversation(
        selectedModel,
        selectedPersonality,
        customPrompt || undefined
      )

      if (conversation) {
        toast.success("AI conversation created!")
        router.push(`/dashboard/conversations/${conversation.id}`)
        router.refresh()
        onClose()
      } else {
        toast.error("Failed to create AI conversation")
      }
    } catch (error) {
      console.error("Error creating AI conversation:", error)
      toast.error("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  const selectedConfig = personalities.find((p) => p.id === selectedPersonality)

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-base font-semibold leading-7 text-foreground">
              Create AI Conversation
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Choose a model and personality for your AI assistant
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="mb-3 block text-sm font-medium leading-6 text-foreground">
              AI Model
            </label>
            <div className="grid grid-cols-1 gap-3">
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModel(model.id)}
                  className={`
                    flex items-start gap-3 rounded-lg border-2 p-4 text-left transition
                    ${
                      selectedModel === model.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }
                  `}
                >
                  <span className="text-2xl">{getModelIcon(model.speed)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{model.name}</span>
                      {model.recommended && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{model.description}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Speed: {model.speed}</span>
                      <span>Quality: {model.quality}</span>
                      <span>Cost: {formatCost(model.cost)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Personality Grid */}
          <div>
            <label className="mb-3 block text-sm font-medium leading-6 text-foreground">
              Personality Type
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {personalities
                .filter((p) => p.id !== "custom")
                .map((personality) => (
                  <button
                    key={personality.id}
                    type="button"
                    onClick={() => setSelectedPersonality(personality.id)}
                    className={`
                    flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition
                    ${
                      selectedPersonality === personality.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }
                  `}
                  >
                    <span className="text-3xl">{personality.icon}</span>
                    <span className="text-sm font-medium text-foreground">{personality.name}</span>
                    <span className="text-xs text-muted-foreground">{personality.description}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Custom Personality Option */}
          <div>
            <button
              type="button"
              onClick={() => setSelectedPersonality("custom")}
              className={`
                flex w-full flex-col items-start gap-2 rounded-lg border-2 p-4 transition
                ${
                  selectedPersonality === "custom"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎨</span>
                <span className="text-sm font-medium text-foreground">Custom Personality</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Define your own system prompt for unique AI behavior
              </span>
            </button>

            {selectedPersonality === "custom" && (
              <div className="mt-4">
                <label
                  htmlFor="customPrompt"
                  className="block text-sm font-medium leading-6 text-foreground"
                >
                  Custom System Prompt
                </label>
                <div className="mt-2">
                  <textarea
                    id="customPrompt"
                    rows={4}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="block w-full rounded-lg border-0 bg-background px-3 py-1.5 text-foreground shadow-sm ring-1 ring-inset ring-border placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-ring sm:text-sm sm:leading-6"
                    placeholder="e.g., You are a helpful coding assistant that specializes in React and TypeScript..."
                    required={selectedPersonality === "custom"}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  This prompt will guide how the AI responds to your messages
                </p>
              </div>
            )}
          </div>

          {/* Selected Personality Preview */}
          {selectedConfig && selectedPersonality !== "custom" && (
            <div className="rounded-lg bg-accent p-4">
              <h3 className="text-sm font-medium text-foreground">Personality Preview</h3>
              <p className="mt-2 text-xs text-muted-foreground">{selectedConfig.systemPrompt}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-border hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || (selectedPersonality === "custom" && !customPrompt.trim())}
              className="gradient-bg rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create AI Chat"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default PersonalitySelectionModal
