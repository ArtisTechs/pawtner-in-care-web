import { API_CONFIG } from '@/config/env'
import { emitAuthSessionInvalid } from './auth-session-events'
import { ApiError, isInvalidBearerTokenError, NETWORK_API_ERROR_MESSAGE } from './api-error'
import { startFullScreenLoaderRequest } from './full-screen-loader-store'
import { wasRecentlyTriggeredByUserAction } from './user-action-tracker'

type RequestOptions<TBody> = {
  body?: TBody
  headers?: Record<string, string>
  loader?: 'always' | 'auto' | 'never'
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
  token?: string
}

const hasBearerAuthHeader = (headers: Headers) => {
  const authorizationHeader = headers.get('Authorization')

  if (!authorizationHeader) {
    return false
  }

  return /^Bearer\b/i.test(authorizationHeader.trim())
}

const buildUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_CONFIG.baseUrl}${normalizedPath}`
}

const parseResponseBody = (rawBody: string) => {
  if (!rawBody) {
    return null
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    return rawBody
  }
}

async function request<TResponse, TBody = undefined>(
  path: string,
  options: RequestOptions<TBody> = {},
) {
  const headers = new Headers(options.headers)
  const method = options.method ?? 'GET'

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const hasBearerAuth = hasBearerAuthHeader(headers)
  const loaderMode = options.loader ?? 'auto'
  const shouldShowFullScreenLoader =
    loaderMode === 'always' ||
    (loaderMode === 'auto' && method !== 'GET' && wasRecentlyTriggeredByUserAction())
  const stopLoaderRequest = shouldShowFullScreenLoader ? startFullScreenLoaderRequest() : null

  try {
    let response: Response

    try {
      response = await fetch(buildUrl(path), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
    } catch (error) {
      throw new ApiError(0, NETWORK_API_ERROR_MESSAGE, error)
    }

    const rawBody = await response.text()
    const payload = parseResponseBody(rawBody)

    if (!response.ok) {
      const apiError = ApiError.fromResponse(response.status, payload)

      if (hasBearerAuth && isInvalidBearerTokenError(apiError)) {
        emitAuthSessionInvalid({
          message: apiError.message,
          path,
          status: apiError.status,
        })
      }

      throw apiError
    }

    return payload as TResponse
  } finally {
    stopLoaderRequest?.()
  }
}

export const apiClient = {
  delete: <TResponse, TBody = undefined>(path: string, options?: RequestOptions<TBody>) =>
    request<TResponse, TBody>(path, { ...options, method: 'DELETE' }),
  get: <TResponse>(path: string, options?: RequestOptions<undefined>) =>
    request<TResponse>(path, { ...options, method: 'GET' }),
  patch: <TResponse, TBody>(
    path: string,
    body: TBody,
    options?: RequestOptions<TBody>,
  ) => request<TResponse, TBody>(path, { ...options, body, method: 'PATCH' }),
  post: <TResponse, TBody>(
    path: string,
    body: TBody,
    options?: RequestOptions<TBody>,
  ) => request<TResponse, TBody>(path, { ...options, body, method: 'POST' }),
  put: <TResponse, TBody>(
    path: string,
    body: TBody,
    options?: RequestOptions<TBody>,
  ) => request<TResponse, TBody>(path, { ...options, body, method: 'PUT' }),
}
