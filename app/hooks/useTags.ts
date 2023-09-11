"use client"

import { useCallback, useEffect, useState } from "react"
import { type Tag } from "@prisma/client"
import toast from "react-hot-toast"

import { api, createLoadingToast } from "@/app/lib/api-client"
import { type TagColor, type TagWithCount } from "@/app/types"

interface UseTagsReturn {
  tags: TagWithCount[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  createTag: (name: string, color: TagColor) => Promise<Tag | null>
  updateTag: (tagId: string, data: { name?: string; color?: TagColor }) => Promise<Tag | null>
  deleteTag: (tagId: string) => Promise<boolean>
}

interface TagsResponse {
  tags: TagWithCount[]
}

interface TagResponse {
  tag: Tag
}

/**
 * Hook for managing user tags
 *
 * Provides CRUD operations for tags with automatic state management
 * and toast notifications.
 */
export function useTags(): UseTagsReturn {
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTags = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await api.get<TagsResponse>("/api/tags", {
        showErrorToast: false,
      })

      setTags(response.tags || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch tags"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const createTag = useCallback(async (name: string, color: TagColor): Promise<Tag | null> => {
    const loader = createLoadingToast("Creating tag...")

    try {
      const response = await api.post<TagResponse>(
        "/api/tags",
        { name, color },
        {
          showErrorToast: false,
        }
      )

      const newTag = response.tag
      setTags((prev) => [...prev, { ...newTag, conversationCount: 0 }])
      loader.success("Tag created")
      return newTag
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create tag"
      loader.error(message)
      return null
    }
  }, [])

  const updateTag = useCallback(
    async (tagId: string, data: { name?: string; color?: TagColor }): Promise<Tag | null> => {
      const loader = createLoadingToast("Updating tag...")

      try {
        const response = await api.patch<TagResponse>(`/api/tags/${tagId}`, data, {
          showErrorToast: false,
        })

        const updatedTag = response.tag
        setTags((prev) =>
          prev.map((t) =>
            t.id === tagId
              ? { ...updatedTag, conversationCount: (t as TagWithCount).conversationCount }
              : t
          )
        )
        loader.success("Tag updated")
        return updatedTag
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update tag"
        loader.error(message)
        return null
      }
    },
    []
  )

  const deleteTag = useCallback(async (tagId: string): Promise<boolean> => {
    const loader = createLoadingToast("Deleting tag...")

    try {
      await api.delete(`/api/tags/${tagId}`, {
        showErrorToast: false,
      })

      setTags((prev) => prev.filter((t) => t.id !== tagId))
      loader.success("Tag deleted")
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete tag"
      loader.error(message)
      return false
    }
  }, [])

  return {
    tags,
    isLoading,
    error,
    refetch: fetchTags,
    createTag,
    updateTag,
    deleteTag,
  }
}

/**
 * Hook for managing tags on a specific conversation
 */
interface UseConversationTagsReturn {
  isLoading: boolean
  addTag: (tagId: string) => Promise<boolean>
  removeTag: (tagId: string) => Promise<boolean>
}

export function useConversationTags(conversationId: string): UseConversationTagsReturn {
  const [isLoading, setIsLoading] = useState(false)

  const addTag = useCallback(
    async (tagId: string): Promise<boolean> => {
      setIsLoading(true)

      try {
        await api.post(
          `/api/conversations/${conversationId}/tags`,
          { tagId },
          {
            showErrorToast: true,
          }
        )

        toast.success("Tag added")
        return true
      } catch {
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [conversationId]
  )

  const removeTag = useCallback(
    async (tagId: string): Promise<boolean> => {
      setIsLoading(true)

      try {
        await api.delete(`/api/conversations/${conversationId}/tags/${tagId}`, {
          showErrorToast: true,
        })

        toast.success("Tag removed")
        return true
      } catch {
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [conversationId]
  )

  return {
    isLoading,
    addTag,
    removeTag,
  }
}
