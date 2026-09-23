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

// Static catalogues: built once per module, not on every render.
const PERSONALITIES = getAllPersonalities()
const PRESET_PERSONALITIES = PERSONALITIES.filter((p) => p.id !== "custom")
const PERSONALITY_BY_ID = new Map(PERSONALITIES.map((p) => [p.id, p]))
const MODELS = getAllModels()

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
  const [selectedModel, setSelectedModel] = useState<ModelType>(getDefaultModel)
  const [customPrompt, setCustomPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)

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
        toast.error("Couldn't create the AI conversation. Try again.")
      }
    } catch (error) {
      console.error("Error creating AI conversation:", error)
      toast.error("Something went wrong. Try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const selectedConfig = PERSONALITY_BY_ID.get(selectedPersonality)

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Create AI Conversation">
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
          <fieldset>
            <legend className="mb-3 block text-sm font-medium leading-6 text-foreground">
              AI Model
            </legend>
            <div className="grid grid-cols-1 gap-3">
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModel(model.id)}
                  aria-pressed={selectedModel === model.id}
                  className={`
                    flex items-start gap-3 rounded-lg border-2 p-4 text-left transition
                    ${
                      selectedModel === model.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }
                  `}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {getModelIcon(model.speed)}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{model.name}</span>
                      {model.recommended && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-accent">
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
          </fieldset>

          {/* Personality Grid */}
          <fieldset>
            <legend className="mb-3 block text-sm font-medium leading-6 text-foreground">
              Personality Type
            </legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PRESET_PERSONALITIES.map((personality) => (
                <button
                  key={personality.id}
                  type="button"
                  onClick={() => setSelectedPersonality(personality.id)}
                  aria-pressed={selectedPersonality === personality.id}
                  className={`
                    flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition
                    ${
                      selectedPersonality === personality.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }
                  `}
                >
                  <span className="text-3xl" aria-hidden="true">
                    {personality.icon}
                  </span>
                  <span className="text-sm font-medium text-foreground">{personality.name}</span>
                  <span className="text-xs text-muted-foreground">{personality.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Custom Personality Option */}
          <div>
            <button
              type="button"
              onClick={() => setSelectedPersonality("custom")}
              aria-pressed={selectedPersonality === "custom"}
              className={`
                flex w-full flex-col items-start gap-2 rounded-lg border-2 p-4 transition
                ${
                  selectedPersonality === "custom"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/30"
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">
                  🎨
                </span>
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
                    name="customPrompt"
                    autoComplete="off"
                    rows={4}
                    maxLength={4000}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="block w-full rounded-md border border-input bg-background px-3 py-1.5 text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm sm:leading-6"
                    placeholder="e.g., You are a helpful coding assistant that specializes in React and TypeScript…"
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
            <div className="rounded-lg bg-muted p-4">
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
              className="rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || (selectedPersonality === "custom" && !customPrompt.trim())}
              className="gradient-bg-cta rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Creating…" : "Create AI Chat"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default PersonalitySelectionModal
