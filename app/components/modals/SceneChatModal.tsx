"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import axios, { isAxiosError } from "axios"
import toast from "react-hot-toast"
import { HiMagnifyingGlass, HiXMark } from "react-icons/hi2"

import { Button } from "@/app/components/ui/button"
import { useCsrfToken, withCsrfHeader } from "@/app/hooks/useCsrfToken"

import Modal from "./Modal"

interface SceneCharacter {
  id: string
  name: string
  tagline: string | null
  avatarUrl: string | null
}

interface SceneChatModalProps {
  isOpen?: boolean
  onClose: () => void
}

const MAX_SCENE_CHARACTERS = 6

const SceneChatModal: React.FC<SceneChatModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter()
  const { token } = useCsrfToken()

  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [characters, setCharacters] = useState<SceneCharacter[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sceneName, setSceneName] = useState("")
  const [sceneScenario, setSceneScenario] = useState("")
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([])

  const selectedCharacters = useMemo(
    () => characters.filter((character) => selectedCharacterIds.includes(character.id)),
    [characters, selectedCharacterIds]
  )

  const filteredCharacters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return characters
    }

    return characters.filter((character) => {
      return (
        character.name.toLowerCase().includes(query) ||
        character.tagline?.toLowerCase().includes(query)
      )
    })
  }, [characters, searchQuery])

  const resetForm = useCallback(() => {
    setSearchQuery("")
    setSceneName("")
    setSceneScenario("")
    setSelectedCharacterIds([])
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let ignore = false
    setIsLoading(true)

    axios
      .get("/api/characters?sort=popular&limit=50")
      .then((response: { data: { characters: SceneCharacter[] } }) => {
        if (!ignore) {
          setCharacters(response.data.characters || [])
        }
      })
      .catch(() => {
        if (!ignore) {
          toast.error("Failed to load characters")
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [isOpen])

  const toggleCharacter = useCallback((characterId: string) => {
    setSelectedCharacterIds((current) => {
      if (current.includes(characterId)) {
        return current.filter((id) => id !== characterId)
      }

      if (current.length >= MAX_SCENE_CHARACTERS) {
        toast.error(`You can select up to ${MAX_SCENE_CHARACTERS} characters`)
        return current
      }

      return [...current, characterId]
    })
  }, [])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!token) {
        toast.error("Security token not available. Please refresh the page.")
        return
      }

      if (selectedCharacterIds.length < 2) {
        toast.error("Select at least 2 characters for a scene")
        return
      }

      setIsSubmitting(true)
      try {
        const response = await axios.post(
          "/api/conversations",
          {
            isAI: true,
            name: sceneName.trim() || undefined,
            sceneScenario: sceneScenario.trim() || undefined,
            sceneCharacterIds: selectedCharacterIds,
          },
          {
            headers: withCsrfHeader(token, {
              "Content-Type": "application/json",
            }),
          }
        )

        toast.success("Scene chat created")
        resetForm()
        onClose()
        router.push(`/dashboard/conversations/${response.data.id}`)
        router.refresh()
      } catch (error) {
        const message =
          isAxiosError(error) && error.response?.data?.error
            ? error.response.data.error
            : "Failed to create scene chat"
        toast.error(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [token, selectedCharacterIds, sceneName, sceneScenario, resetForm, onClose, router]
  )

  const handleClose = useCallback(() => {
    if (isSubmitting) {
      return
    }
    resetForm()
    onClose()
  }, [isSubmitting, resetForm, onClose])

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div className="border-b border-gray-900/10 pb-4">
            <h2 className="text-base font-semibold leading-7 text-gray-900">Create scene chat</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Pick multiple AI characters and set an optional scenario.
            </p>
          </div>

          <div>
            <label htmlFor="sceneName" className="text-sm font-medium leading-6 text-gray-900">
              Scene name (optional)
            </label>
            <input
              id="sceneName"
              value={sceneName}
              onChange={(event) => setSceneName(event.target.value)}
              maxLength={100}
              disabled={isSubmitting}
              placeholder="e.g. Space Mission Briefing"
              className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label htmlFor="sceneScenario" className="text-sm font-medium leading-6 text-gray-900">
              Scenario setup (optional)
            </label>
            <textarea
              id="sceneScenario"
              rows={3}
              value={sceneScenario}
              onChange={(event) => setSceneScenario(event.target.value)}
              maxLength={1000}
              disabled={isSubmitting}
              placeholder="e.g. The team is planning a rescue before sunrise."
              className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              The AI will use this as shared context for all scene characters.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium leading-6 text-gray-900">Characters</label>
              <span className="text-xs text-gray-500">
                {selectedCharacterIds.length}/{MAX_SCENE_CHARACTERS} selected
              </span>
            </div>

            <div className="relative">
              <HiMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search characters..."
                className="block w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {selectedCharacters.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedCharacters.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => toggleCharacter(character.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-200"
                  >
                    {character.name}
                    <HiXMark className="size-3.5" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-2">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-gray-500">Loading characters...</div>
              ) : filteredCharacters.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">No characters found</div>
              ) : (
                filteredCharacters.map((character) => {
                  const selected = selectedCharacterIds.includes(character.id)
                  return (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => toggleCharacter(character.id)}
                      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                        selected
                          ? "border-purple-400 bg-purple-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                      aria-pressed={selected}
                    >
                      {character.avatarUrl ? (
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-gray-200">
                          <Image
                            src={character.avatarUrl}
                            alt={character.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
                          {character.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {character.name}
                        </p>
                        {character.tagline && (
                          <p className="truncate text-xs text-gray-500">{character.tagline}</p>
                        )}
                      </div>
                      {selected && (
                        <span className="text-xs font-medium text-purple-700">Selected</span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || selectedCharacterIds.length < 2}>
            {isSubmitting ? "Creating..." : "Create Scene"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default SceneChatModal
