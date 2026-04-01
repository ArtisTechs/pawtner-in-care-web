import { API_CONFIG } from '@/config/env'
import { ApiError } from './api-error'

type RequestOptions<TBody> = {
  body?: TBody
  headers?: Record<string, string>
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
  token?: string
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

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  let response: Response

  try {
    response = await fetch(buildUrl(path), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new Error('Unable to reach the API')
  }

  const rawBody = await response.text()
  const payload = parseResponseBody(rawBody)

  if (!response.ok) {
    throw ApiError.fromResponse(response.status, payload)
  }

  return payload as TResponse
}

export const apiClient = {
  delete: <TResponse>(path: string, options?: RequestOptions<undefined>) =>
    request<TResponse>(path, { ...options, method: 'DELETE' }),
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
