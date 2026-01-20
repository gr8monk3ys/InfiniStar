import { NextResponse } from "next/server"

// Standard error codes
export enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  BAD_REQUEST = "BAD_REQUEST",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR",
}

// Error response interface
export interface ErrorResponse {
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, unknown>
  }
}

// Standard error messages
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHORIZED]: "Authentication required. Please sign in to continue.",
  [ErrorCode.FORBIDDEN]: "You do not have permission to perform this action.",
  [ErrorCode.NOT_FOUND]: "The requested resource was not found.",
  [ErrorCode.BAD_REQUEST]: "Invalid request. Please check your input and try again.",
  [ErrorCode.VALIDATION_ERROR]: "Validation failed. Please check your input.",
  [ErrorCode.RATE_LIMIT_EXCEEDED]: "Too many requests. Please try again later.",
  [ErrorCode.INTERNAL_ERROR]: "An unexpected error occurred. Please try again.",
  [ErrorCode.DATABASE_ERROR]: "Database operation failed. Please try again.",
  [ErrorCode.EXTERNAL_API_ERROR]: "External service error. Please try again later.",
}

// Error factory functions
export function createErrorResponse(
  code: ErrorCode,
  customMessage?: string,
  details?: Record<string, unknown>
): NextResponse<ErrorResponse> {
  const message = customMessage || ERROR_MESSAGES[code]

  const statusCode = getStatusCode(code)

  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status: statusCode }
  )
}

function getStatusCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.UNAUTHORIZED:
      return 401
    case ErrorCode.FORBIDDEN:
      return 403
    case ErrorCode.NOT_FOUND:
      return 404
    case ErrorCode.BAD_REQUEST:
    case ErrorCode.VALIDATION_ERROR:
      return 400
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return 429
    case ErrorCode.DATABASE_ERROR:
    case ErrorCode.EXTERNAL_API_ERROR:
    case ErrorCode.INTERNAL_ERROR:
    default:
      return 500
  }
}

// Convenience functions
export const ApiError = {
  unauthorized: (message?: string, details?: Record<string, unknown>) =>
    createErrorResponse(ErrorCode.UNAUTHORIZED, message, details),

  forbidden: (message?: string, details?: Record<string, unknown>) =>
    createErrorResponse(ErrorCode.FORBIDDEN, message, details),

  notFound: (resource?: string, details?: Record<string, unknown>) =>
    createErrorResponse(
      ErrorCode.NOT_FOUND,
      resource ? `${resource} not found` : undefined,
      details
    ),

  badRequest: (message?: string, details?: Record<string, unknown>) =>
    createErrorResponse(ErrorCode.BAD_REQUEST, message, details),

  validation: (message?: string, details?: Record<string, unknown>) =>
    createErrorResponse(ErrorCode.VALIDATION_ERROR, message, details),

  rateLimit: (message?: string, details?: Record<string, unknown>) =>
    createErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, message, details),

  internal: (message?: string, details?: Record<string, unknown>) =>
    createErrorResponse(ErrorCode.INTERNAL_ERROR, message, details),

  database: (message?: string, details?: Record<string, unknown>) =>
    createErrorResponse(ErrorCode.DATABASE_ERROR, message, details),

  externalApi: (service?: string, details?: Record<string, unknown>) =>
    createErrorResponse(
      ErrorCode.EXTERNAL_API_ERROR,
      service ? `${service} API error` : undefined,
      details
    ),
}

// Error logging helper
export function logError(error: unknown, context?: string) {
  console.error(`[${context || "ERROR"}]:`, error)

  // In production, send to error tracking service (e.g., Sentry)
  if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
    // @ts-ignore - Sentry example
    if (window.Sentry) {
      // @ts-ignore
      window.Sentry.captureException(error, {
        tags: { context },
      })
    }
  }
}

// Error handling wrapper for API routes
export function withErrorHandling<T>(
  handler: () => Promise<T>,
  context?: string
): Promise<T | NextResponse<ErrorResponse>> {
  return handler().catch((error) => {
    logError(error, context)

    // Handle Prisma errors
    if (error.code && error.code.startsWith("P")) {
      return ApiError.database("Database operation failed")
    }

    // Handle Zod validation errors
    if (error.name === "ZodError") {
      return ApiError.validation("Validation failed", { errors: error.errors })
    }

    // Default to internal error
    return ApiError.internal()
  })
}
