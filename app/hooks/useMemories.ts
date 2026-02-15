"use client"

import { useCallback, useEffect, useState } from "react"
import { MemoryCategory, type AIMemory } from "@prisma/client"

import { api, createLoadingToast } from "@/app/lib/api-client"

export interface MemoryWithMeta extends AIMemory {
  isExpired?: boolean
}

export interface MemoryCapacity {
  current: number
  limit: number
  remaining: number
}

export interface ExtractedMemory {
  key: string
  content: string
  category: MemoryCategory
  importance: number
}

interface MemoriesResponse {
  memories: MemoryWithMeta[]
  capacity: MemoryCapacity
  categories: Record<string, { label: string; description: string; icon: string; color: string }>
}

interface MemoryResponse {
  memory: AIMemory
  isUpdate: boolean
  message: string
}

interface ExtractResponse {
  extracted: ExtractedMemory[]
  saved: number
  failed?: number
  message: string
  capacityExceeded?: boolean
}

interface UseMemoriesOptions {
  category?: MemoryCategory
  includeExpired?: boolean
}

interface UseMemoriesReturn {
  memories: MemoryWithMeta[]
  capacity: MemoryCapacity | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  createMemory: (
    key: string,
    content: string,
    options?: {
      category?: MemoryCategory
      importance?: number
      expiresAt?: string | null
    }
  ) => Promise<AIMemory | null>
  deleteMemory: (key: string) => Promise<boolean>
  extractMemories: (conversationId: string, autoSave?: boolean) => Promise<ExtractedMemory[] | null>
}

/**
 * Hook for managing AI memories
 *
 * Provides CRUD operations for AI memories with automatic state management
 * and toast notifications.
 */
export function useMemories(options?: UseMemoriesOptions): UseMemoriesReturn {
  const [memories, setMemories] = useState<MemoryWithMeta[]>([])
  const [capacity, setCapacity] = useState<MemoryCapacity | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMemories = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options?.category) {
        params.set("category", options.category)
      }
      if (options?.includeExpired) {
        params.set("includeExpired", "true")
      }

      const url = `/api/ai/memory${params.toString() ? `?${params.toString()}` : ""}`
      const response = await api.get<MemoriesResponse>(url, {
        showErrorToast: false,
      })

      setMemories(response.memories || [])
      setCapacity(response.capacity || null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch memories"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [options?.category, options?.includeExpired])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  const createMemory = useCallback(
    async (
      key: string,
      content: string,
      memoryOptions?: {
        category?: MemoryCategory
        importance?: number
        expiresAt?: string | null
      }
    ): Promise<AIMemory | null> => {
      const loader = createLoadingToast("Saving memory...")

      try {
        const response = await api.post<MemoryResponse>(
          "/api/ai/memory",
          {
            key,
            content,
            category: memoryOptions?.category || MemoryCategory.FACT,
            importance: memoryOptions?.importance || 3,
            expiresAt: memoryOptions?.expiresAt || null,
          },
          {
            showErrorToast: false,
          }
        )

        const newMemory = response.memory

        if (response.isUpdate) {
          // Update existing memory in state
          setMemories((prev) =>
            prev.map((m) => (m.key === key ? { ...newMemory, isExpired: false } : m))
          )
        } else {
          // Add new memory to state
          setMemories((prev) => [...prev, { ...newMemory, isExpired: false }])
          // Update capacity
          if (capacity) {
            setCapacity({
              ...capacity,
              current: capacity.current + 1,
              remaining: capacity.remaining - 1,
            })
          }
        }

        loader.success(response.message || "Memory saved")
        return newMemory
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save memory"
        loader.error(message)
        return null
      }
    },
    [capacity]
  )

  const deleteMemory = useCallback(async (key: string): Promise<boolean> => {
    const loader = createLoadingToast("Deleting memory...")

    try {
      await api.delete(`/api/ai/memory/${encodeURIComponent(key)}`, {
        showErrorToast: false,
      })

      setMemories((prev) => prev.filter((m) => m.key !== key))
      setCapacity((prev) =>
        prev
          ? {
              ...prev,
              current: prev.current - 1,
              remaining: prev.remaining + 1,
            }
          : null
      )
      loader.success("Memory deleted")
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete memory"
      loader.error(message)
      return false
    }
  }, [])

  const extractMemories = useCallback(
    async (conversationId: string, autoSave = false): Promise<ExtractedMemory[] | null> => {
      const loader = createLoadingToast("Analyzing conversation...")

      try {
        const response = await api.post<ExtractResponse>(
          "/api/ai/memory/extract",
          {
            conversationId,
            autoSave,
          },
          {
            showErrorToast: false,
            timeoutMs: 60000, // Allow more time for AI extraction
          }
        )

        if (response.capacityExceeded) {
          loader.error(response.message)
        } else {
          loader.success(response.message)
        }

        // If memories were auto-saved, refetch to get updated list
        if (autoSave && response.saved > 0) {
          await fetchMemories()
        }

        return response.extracted
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to extract memories"
        loader.error(message)
        return null
      }
    },
    [fetchMemories]
  )

  return {
    memories,
    capacity,
    isLoading,
    error,
    refetch: fetchMemories,
    createMemory,
    deleteMemory,
    extractMemories,
  }
}
