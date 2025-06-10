/**
 * API Client Utilities
 *
 * Provides consistent error handling, retry logic, and timeout management
 * for all client-side API calls
 */

import axios, { type AxiosError, type AxiosRequestConfig } from "axios"
import toast from "react-hot-toast"

import { clearClientCsrfTokenCache, getClientCsrfToken } from "@/app/lib/csrf-client"

export interface ApiClientConfig extends AxiosRequestConfig {
  retries?: number
  retryDelay?: number
  showErrorToast?: boolean
  timeoutMs?: number
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: AxiosError | null
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if error is retryable (network errors, 5xx, 429)
 */
function isRetryableError(error: AxiosError): boolean {
  if (!error.response) {
    // Network error or timeout
    return true
  }

  const status = error.response.status
  // Retry on 5xx server errors or 429 rate limit
  return status >= 500 || status === 429
}

/**
 * Get user-friendly error message from API error
 */
function getErrorMessage(error: AxiosError): string {
  if (!error.response) {
    return "Network error. Please check your connection and try again."
  }

  const status = error.response.status
  const data = error.response.data as { error?: string; message?: string } | undefined

  // Use server's error message if available
  if (data?.error) {
    return data.error
  }

  if (data?.message) {
    return data.message
  }

  // Default messages for common status codes
  switch (status) {
    case 400:
      return "Invalid request. Please check your input."
    case 401:
      return "Please log in to continue."
    case 403:
      return "You do not have permission to perform this action."
    case 404:
      return "Resource not found."
    case 429:
      return "Too many requests. Please try again later."
    case 500:
      return "Server error. Please try again later."
    case 503:
      return "Service temporarily unavailable. Please try again later."
    default:
      return "Something went wrong. Please try again."
  }
}

function isMutationMethod(method?: string): boolean {
  if (!method) return false
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())
}

function isSameOriginApiUrl(url?: string): boolean {
  if (!url) return false
  return url.startsWith("/")
}

async function withCsrfHeaderIfNeeded(
  axiosConfig: AxiosRequestConfig
): Promise<AxiosRequestConfig> {
  const method = (axiosConfig.method ?? "GET").toUpperCase()
  const url = axiosConfig.url

  if (!isMutationMethod(method) || !isSameOriginApiUrl(url)) {
    return axiosConfig
  }

  const headers = (axiosConfig.headers ?? {}) as Record<string, unknown>
  const existingToken = headers["X-CSRF-Token"]

  // If a non-empty token was provided explicitly, respect it.
  if (typeof existingToken === "string" && existingToken.trim().length > 0) {
    return axiosConfig
  }

  const token = await getClientCsrfToken()
  if (!token) {
    // Fail fast with a better error than a generic 403 downstream.
    throw new ApiError("Security token not available. Please refresh and try again.", 403, null)
  }

  return {
    ...axiosConfig,
    withCredentials: true,
    headers: {
      ...headers,
      "X-CSRF-Token": token,
    },
  }
}

/**
 * Make an API request with retry logic and error handling
 *
 * @example
 * ```ts
 * const data = await apiRequest({
 *   method: 'POST',
 *   url: '/api/messages',
 *   data: { message: 'Hello' },
 *   retries: 3,
 *   showErrorToast: true
 * });
 * ```
 */
export async function apiRequest<T = unknown>(config: ApiClientConfig): Promise<T> {
  const {
    retries = 2,
    retryDelay = 1000,
    showErrorToast = true,
    timeoutMs = 30000,
    ...axiosConfig
  } = config

  let lastError: AxiosError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const axiosConfigWithCsrf = await withCsrfHeaderIfNeeded(axiosConfig)
      const response = await axios({
        ...axiosConfigWithCsrf,
        timeout: timeoutMs,
      })

      return response.data
    } catch (error) {
      lastError = error as AxiosError

      // If CSRF token expired/rotated, clear cache and retry once.
      if (
        lastError.response?.status === 403 &&
        typeof (lastError.response.data as { error?: unknown } | undefined)?.error === "string" &&
        String((lastError.response.data as { error?: unknown }).error)
          .toLowerCase()
          .includes("csrf") &&
        attempt < retries
      ) {
        clearClientCsrfTokenCache()
        continue
      }

      // Don't retry if error is not retryable
      if (!isRetryableError(lastError)) {
        break
      }

      // Don't retry on last attempt
      if (attempt < retries) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = retryDelay * Math.pow(2, attempt)
        await sleep(delay)
        continue
      }
    }
  }

  // All retries failed, throw error
  const errorMessage = getErrorMessage(lastError!)

  if (showErrorToast) {
    toast.error(errorMessage)
  }

  throw new ApiError(errorMessage, lastError?.response?.status, lastError)
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: <T = unknown>(url: string, config?: ApiClientConfig) =>
    apiRequest<T>({ ...config, method: "GET", url }),

  post: <T = unknown>(url: string, data?: unknown, config?: ApiClientConfig) =>
    apiRequest<T>({ ...config, method: "POST", url, data }),

  put: <T = unknown>(url: string, data?: unknown, config?: ApiClientConfig) =>
    apiRequest<T>({ ...config, method: "PUT", url, data }),

  patch: <T = unknown>(url: string, data?: unknown, config?: ApiClientConfig) =>
    apiRequest<T>({ ...config, method: "PATCH", url, data }),

  delete: <T = unknown>(url: string, config?: ApiClientConfig) =>
    apiRequest<T>({ ...config, method: "DELETE", url }),
}

/**
 * Create a loading toast that can be updated
 *
 * @example
 * ```ts
 * const loader = createLoadingToast('Saving...');
 * try {
 *   await api.post('/api/save', data);
 *   loader.success('Saved!');
 * } catch (error) {
 *   loader.error('Failed to save');
 * }
 * ```
 */
export function createLoadingToast(message: string) {
  const toastId = toast.loading(message)

  return {
    success: (successMessage: string) => {
      toast.success(successMessage, { id: toastId })
    },
    error: (errorMessage: string) => {
      toast.error(errorMessage, { id: toastId })
    },
    dismiss: () => {
      toast.dismiss(toastId)
    },
  }
}
