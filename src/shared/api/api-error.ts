type ApiErrorPayload = {
  error?: string
  message?: string
}

const DEFAULT_API_ERROR_MESSAGE =
  'Something went wrong. Please contact the system administrator.'

const extractApiErrorMessage = (
  payload: unknown,
  fallback = DEFAULT_API_ERROR_MESSAGE,
) => {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  if (payload && typeof payload === 'object') {
    const typedPayload = payload as ApiErrorPayload

    if (typedPayload.message?.trim()) {
      return typedPayload.message
    }

    if (typedPayload.error?.trim()) {
      return typedPayload.error
    }
  }

  return fallback
}

export class ApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }

  static fromResponse(status: number, payload: unknown) {
    return new ApiError(status, extractApiErrorMessage(payload), payload)
  }
}

export const getErrorMessage = (
  error: unknown,
  fallback = DEFAULT_API_ERROR_MESSAGE,
) => {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
