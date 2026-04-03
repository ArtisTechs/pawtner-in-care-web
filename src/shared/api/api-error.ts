type ApiErrorPayload = {
  error?: string
  message?: string
}

const DEFAULT_API_ERROR_MESSAGE =
  'Something went wrong. Please contact the system administrator.'
const INVALID_BEARER_ERROR_PATTERNS = [
  /invalid token bearer/i,
  /invalid bearer token/i,
  /expired token/i,
  /token expired/i,
  /jwt expired/i,
]

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

const hasInvalidBearerMarker = (value: string) =>
  INVALID_BEARER_ERROR_PATTERNS.some((pattern) => pattern.test(value))

export const isInvalidBearerTokenError = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return false
  }

  if (error.status === 401) {
    return true
  }

  if (error.status !== 403) {
    return false
  }

  if (hasInvalidBearerMarker(error.message)) {
    return true
  }

  const detailsMessage = extractApiErrorMessage(error.details, '')
  return detailsMessage ? hasInvalidBearerMarker(detailsMessage) : false
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
