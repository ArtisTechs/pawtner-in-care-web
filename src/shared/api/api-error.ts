type ApiErrorPayload = {
  error?: string
  message?: string
}

const DEFAULT_API_ERROR_MESSAGE =
  'Something went wrong. Please contact the system administrator.'
export const NETWORK_API_ERROR_MESSAGE =
  'Network error. Please check your internet connection and try again.'
const INVALID_BEARER_ERROR_PATTERNS = [
  /invalid token bearer/i,
  /invalid bearer token/i,
  /invalid token/i,
  /token is invalid/i,
  /expired token/i,
  /token expired/i,
  /jwt expired/i,
  /bearer token is malformed/i,
  /malformed jwt/i,
  /full authentication is required/i,
]
const NETWORK_ERROR_PATTERNS = [
  /\bnetwork error\b/i,
  /\bnetworkerror\b/i,
  /networkerror when attempting to fetch resource/i,
  /failed to fetch/i,
  /fetch failed/i,
  /network request failed/i,
  /internet connection appears to be offline/i,
  /unable to reach (?:the api|cloudinary)/i,
  /load failed/i,
  /err_network/i,
  /err_internet_disconnected/i,
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
const hasNetworkErrorMarker = (value: string) =>
  NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(value))

export const isInvalidBearerTokenMessage = (value: unknown) => {
  if (typeof value !== 'string') {
    return false
  }

  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return false
  }

  return hasInvalidBearerMarker(normalizedValue)
}

export const isNetworkError = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return true
    }

    if (hasNetworkErrorMarker(error.message)) {
      return true
    }

    const detailsMessage = extractApiErrorMessage(error.details, '')
    return Boolean(detailsMessage && hasNetworkErrorMarker(detailsMessage))
  }

  if (!(error instanceof Error)) {
    return false
  }

  return hasNetworkErrorMarker(error.message)
}

export const isInvalidBearerTokenError = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return false
  }

  if (isInvalidBearerTokenMessage(error.message)) {
    return true
  }

  const detailsMessage = extractApiErrorMessage(error.details, '')

  if (isInvalidBearerTokenMessage(detailsMessage)) {
    return true
  }

  if (error.status === 401) {
    return true
  }

  if (error.status !== 403) {
    return false
  }

  return false
}

export const getErrorMessage = (
  error: unknown,
  fallback = DEFAULT_API_ERROR_MESSAGE,
) => {
  if (isNetworkError(error)) {
    return NETWORK_API_ERROR_MESSAGE
  }

  if (error instanceof ApiError) {
    const normalizedMessage = error.message.trim()
    return normalizedMessage || fallback
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}
