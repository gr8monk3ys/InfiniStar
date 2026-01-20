"use client"

import { useCallback, useEffect, useState } from "react"

import { api, createLoadingToast } from "@/app/lib/api-client"
import { TEMPLATE_CATEGORIES, type MessageTemplateType, type TemplateVariables } from "@/app/types"

/**
 * Template limit info from the server
 */
interface TemplateLimitInfo {
  current: number
  limit: number
  remaining: number
  isLimitReached: boolean
  isPro: boolean
}

/**
 * Options for fetching templates
 */
interface FetchTemplatesOptions {
  category?: string
  sortBy?: "name" | "createdAt" | "updatedAt" | "usageCount"
  sortOrder?: "asc" | "desc"
  limit?: number
  search?: string
}

/**
 * Data for creating a template
 */
interface CreateTemplateData {
  name: string
  content: string
  shortcut?: string | null
  category?: string | null
}

/**
 * Data for updating a template
 */
interface UpdateTemplateData {
  name?: string
  content?: string
  shortcut?: string | null
  category?: string | null
}

/**
 * Response from the templates API
 */
interface TemplatesResponse {
  templates: MessageTemplateType[]
  total: number
  limitInfo: TemplateLimitInfo
  categories: string[]
  predefinedCategories: typeof TEMPLATE_CATEGORIES
}

/**
 * Response from the template API (single template)
 */
interface TemplateResponse {
  template: MessageTemplateType
  limitInfo?: TemplateLimitInfo
}

/**
 * Response from the use template API
 */
interface UseTemplateResponse {
  template: MessageTemplateType
  content: string
  rawContent: string
}

/**
 * Response from the shortcut search API
 */
interface ShortcutSearchResponse {
  templates: MessageTemplateType[]
  total: number
}

/**
 * Response from the popular templates API
 */
interface PopularTemplatesResponse {
  templates: MessageTemplateType[]
  total: number
  type: "popular" | "recent"
}

/**
 * Custom hook for managing message templates
 */
export function useTemplates() {
  const [templates, setTemplates] = useState<MessageTemplateType[]>([])
  const [popularTemplates, setPopularTemplates] = useState<MessageTemplateType[]>([])
  const [recentTemplates, setRecentTemplates] = useState<MessageTemplateType[]>([])
  const [limitInfo, setLimitInfo] = useState<TemplateLimitInfo | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch all templates with optional filtering
   */
  const fetchTemplates = useCallback(async (options: FetchTemplatesOptions = {}) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (options.category) params.set("category", options.category)
      if (options.sortBy) params.set("sortBy", options.sortBy)
      if (options.sortOrder) params.set("sortOrder", options.sortOrder)
      if (options.limit) params.set("limit", options.limit.toString())
      if (options.search) params.set("search", options.search)

      const queryString = params.toString()
      const url = `/api/templates${queryString ? `?${queryString}` : ""}`

      const response = await api.get<TemplatesResponse>(url, { showErrorToast: false })

      setTemplates(response.templates)
      setLimitInfo(response.limitInfo)
      setCategories(response.categories)

      return response
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch templates"
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch popular templates
   */
  const fetchPopularTemplates = useCallback(async (limit: number = 5) => {
    try {
      const response = await api.get<PopularTemplatesResponse>(
        `/api/templates/popular?limit=${limit}&type=popular`,
        { showErrorToast: false }
      )
      setPopularTemplates(response.templates)
      return response.templates
    } catch {
      return []
    }
  }, [])

  /**
   * Fetch recently used templates
   */
  const fetchRecentTemplates = useCallback(async (limit: number = 5) => {
    try {
      const response = await api.get<PopularTemplatesResponse>(
        `/api/templates/popular?limit=${limit}&type=recent`,
        { showErrorToast: false }
      )
      setRecentTemplates(response.templates)
      return response.templates
    } catch {
      return []
    }
  }, [])

  /**
   * Search templates by shortcut (for autocomplete)
   */
  const searchByShortcut = useCallback(async (shortcut: string): Promise<MessageTemplateType[]> => {
    if (!shortcut || shortcut.length < 1) return []

    try {
      const response = await api.get<ShortcutSearchResponse>(
        `/api/templates/shortcut?shortcut=${encodeURIComponent(shortcut)}&exact=false`,
        { showErrorToast: false }
      )
      return response.templates
    } catch {
      return []
    }
  }, [])

  /**
   * Find template by exact shortcut
   */
  const findByShortcut = useCallback(
    async (shortcut: string): Promise<MessageTemplateType | null> => {
      if (!shortcut) return null

      try {
        const response = await api.get<TemplateResponse>(
          `/api/templates/shortcut?shortcut=${encodeURIComponent(shortcut)}&exact=true`,
          { showErrorToast: false }
        )
        return response.template
      } catch {
        return null
      }
    },
    []
  )

  /**
   * Get a single template by ID
   */
  const getTemplate = useCallback(
    async (templateId: string): Promise<MessageTemplateType | null> => {
      try {
        const response = await api.get<TemplateResponse>(`/api/templates/${templateId}`, {
          showErrorToast: false,
        })
        return response.template
      } catch {
        return null
      }
    },
    []
  )

  /**
   * Create a new template
   */
  const createTemplate = useCallback(
    async (data: CreateTemplateData): Promise<MessageTemplateType | null> => {
      const loader = createLoadingToast("Creating template...")

      try {
        const response = await api.post<TemplateResponse>("/api/templates", data, {
          showErrorToast: false,
        })

        loader.success("Template created!")

        // Update state
        setTemplates((prev) => [...prev, response.template])
        if (response.limitInfo) {
          setLimitInfo(response.limitInfo)
        }

        return response.template
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create template"
        loader.error(errorMessage)
        throw err
      }
    },
    []
  )

  /**
   * Update a template
   */
  const updateTemplate = useCallback(
    async (templateId: string, data: UpdateTemplateData): Promise<MessageTemplateType | null> => {
      const loader = createLoadingToast("Updating template...")

      try {
        const response = await api.patch<TemplateResponse>(`/api/templates/${templateId}`, data, {
          showErrorToast: false,
        })

        loader.success("Template updated!")

        // Update state
        setTemplates((prev) => prev.map((t) => (t.id === templateId ? response.template : t)))

        return response.template
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update template"
        loader.error(errorMessage)
        throw err
      }
    },
    []
  )

  /**
   * Delete a template
   */
  const deleteTemplate = useCallback(async (templateId: string): Promise<boolean> => {
    const loader = createLoadingToast("Deleting template...")

    try {
      const response = await api.delete<{ success: boolean; limitInfo: TemplateLimitInfo }>(
        `/api/templates/${templateId}`,
        { showErrorToast: false }
      )

      loader.success("Template deleted!")

      // Update state
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
      setPopularTemplates((prev) => prev.filter((t) => t.id !== templateId))
      setRecentTemplates((prev) => prev.filter((t) => t.id !== templateId))
      if (response.limitInfo) {
        setLimitInfo(response.limitInfo)
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete template"
      loader.error(errorMessage)
      throw err
    }
  }, [])

  /**
   * Apply a template (increment usage count and get processed content)
   */
  const applyTemplate = useCallback(
    async (
      templateId: string,
      variables?: TemplateVariables
    ): Promise<{ content: string; rawContent: string } | null> => {
      try {
        const response = await api.post<UseTemplateResponse>(
          `/api/templates/${templateId}/use`,
          { variables },
          { showErrorToast: false }
        )

        // Update the template in state with new usage count
        const updatedTemplate = response.template
        setTemplates((prev) => prev.map((t) => (t.id === templateId ? updatedTemplate : t)))

        return {
          content: response.content,
          rawContent: response.rawContent,
        }
      } catch {
        return null
      }
    },
    []
  )

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await Promise.all([fetchTemplates(), fetchPopularTemplates(), fetchRecentTemplates()])
  }, [fetchTemplates, fetchPopularTemplates, fetchRecentTemplates])

  return {
    // State
    templates,
    popularTemplates,
    recentTemplates,
    limitInfo,
    categories,
    predefinedCategories: TEMPLATE_CATEGORIES,
    isLoading,
    error,

    // Actions
    fetchTemplates,
    fetchPopularTemplates,
    fetchRecentTemplates,
    searchByShortcut,
    findByShortcut,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
    refresh,
  }
}

/**
 * Hook for shortcut detection in message input
 */
export function useShortcutDetection(
  inputValue: string,
  onShortcutDetected: (shortcut: string, templates: MessageTemplateType[]) => void,
  debounceMs: number = 200
) {
  const { searchByShortcut } = useTemplates()
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    // Check if input starts with / and has more characters
    const shortcutMatch = inputValue.match(/^\/([a-zA-Z0-9_-]*)$/)

    if (!shortcutMatch) {
      onShortcutDetected("", [])
      return
    }

    const shortcut = `/${shortcutMatch[1]}`

    // Debounce the search
    const timeoutId = setTimeout(async () => {
      setIsSearching(true)
      try {
        const templates = await searchByShortcut(shortcut)
        onShortcutDetected(shortcut, templates)
      } finally {
        setIsSearching(false)
      }
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [inputValue, searchByShortcut, onShortcutDetected, debounceMs])

  return { isSearching }
}
