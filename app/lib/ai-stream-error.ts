/**
 * Shared structured error for the SSE AI endpoints (/api/ai/chat-stream and
 * /api/ai/regenerate).
 *
 * Both endpoints answer a non-OK request with a JSON body carrying a machine
 * readable `code` (e.g. "FREE_TIER_MESSAGE_LIMIT_REACHED") and a `limits`
 * payload. Callers use that code to open the upgrade dialog instead of showing
 * a dead-end toast, so the code must survive the trip from `fetch` to the
 * hook's `onError` callback — a plain `new Error(body.error)` throws it away.
 */

/** Details for AI stream errors, populated from the API's JSON error body. */
export interface AiStreamErrorDetails {
  /** Machine-readable error code, e.g. "FREE_TIER_MESSAGE_LIMIT_REACHED" */
  code?: string
  /** Usage limits payload returned alongside limit errors (AiAccessDecision["limits"]) */
  limits?: unknown
  /** HTTP status code of the failed response */
  status?: number
}

/** Error thrown for non-OK HTTP responses, carrying structured API details. */
export class AiStreamRequestError extends Error {
  details: AiStreamErrorDetails

  constructor(message: string, details: AiStreamErrorDetails) {
    super(message)
    this.name = "AiStreamRequestError"
    this.details = details
  }
}

/**
 * Reads a non-OK response body and builds an `AiStreamRequestError` from it,
 * falling back to the status code when the body is missing or not JSON.
 */
export async function buildAiStreamRequestError(response: Response): Promise<AiStreamRequestError> {
  const errorBody: unknown = await response.json().catch(() => null)
  const errorData =
    errorBody && typeof errorBody === "object"
      ? (errorBody as { error?: unknown; code?: unknown; limits?: unknown })
      : {}

  return new AiStreamRequestError(
    typeof errorData.error === "string" && errorData.error
      ? errorData.error
      : `HTTP error! status: ${response.status}`,
    {
      code: typeof errorData.code === "string" ? errorData.code : undefined,
      limits: errorData.limits,
      status: response.status,
    }
  )
}
