import type {
  User,
  UserPayload,
  UserSortBy,
  UserSortDirection,
} from '@/features/users/types/user-api'
import { ApiError } from '@/shared/api/api-error'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

const inFlightUserListRequests = new Map<string, Promise<User[]>>()

type UserListResponse = User[] | { content?: User[] | null }

interface UserListParams {
  active?: boolean
  email?: string
  firstName?: string
  lastName?: string
  middleName?: string
  page?: number
  profilePicture?: string
  role?: string
  search?: string
  size?: number
  sortBy?: UserSortBy
  sortDir?: UserSortDirection
}

const normalizeUserListResponse = (value: UserListResponse): User[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const buildUserListPath = (params?: UserListParams) => {
  if (!params) {
    return API_ENDPOINTS.users.base
  }

  const query = new URLSearchParams()
  const paramEntries = Object.entries(params)

  paramEntries.forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }

    const serializedValue = typeof value === 'string' ? value.trim() : String(value)
    if (!serializedValue) {
      return
    }

    query.set(key, serializedValue)
  })

  const queryString = query.toString()
  return queryString ? `${API_ENDPOINTS.users.base}?${queryString}` : API_ENDPOINTS.users.base
}

const listUsers = (token: string, params?: UserListParams) => {
  const path = buildUserListPath(params)
  const requestKey = `${token}::${path}`
  const cachedRequest = inFlightUserListRequests.get(requestKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient.get<UserListResponse>(path, { token }).then(normalizeUserListResponse)
  inFlightUserListRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightUserListRequests.delete(requestKey)
  })

  return request
}

const tryPatchToggleActive = async (
  path: string,
  payload: Record<string, boolean>,
  token: string,
  headers?: Record<string, string>,
) => {
  return apiClient.patch<User, Record<string, boolean>>(path, payload, { headers, token })
}

const tryPatchToggleWithoutPayload = async (
  path: string,
  token: string,
  headers?: Record<string, string>,
) => {
  return apiClient.patch<User, Record<string, never>>(path, {}, { headers, token })
}

const toggleUserActive = async (
  userId: string,
  active: boolean,
  token: string,
  currentUserId?: string,
) => {
  const headers = currentUserId ? { 'X-User-Id': currentUserId } : undefined
  const endpointAttempts: Array<() => Promise<User>> = [
    () => tryPatchToggleActive(API_ENDPOINTS.users.byIdActive(userId), { active }, token, headers),
    () => tryPatchToggleActive(API_ENDPOINTS.users.byIdStatus(userId), { active }, token, headers),
    () =>
      tryPatchToggleWithoutPayload(
        active ? API_ENDPOINTS.users.enable(userId) : API_ENDPOINTS.users.disable(userId),
        token,
        headers,
      ),
  ]

  let latestError: unknown

  for (const endpointAttempt of endpointAttempts) {
    try {
      return await endpointAttempt()
    } catch (error) {
      latestError = error

      if (error instanceof ApiError && error.status !== 404 && error.status !== 405) {
        throw error
      }
    }
  }

  throw latestError ?? new Error('Unable to update active status for this user.')
}

export const userService = {
  create: (payload: UserPayload, token: string) =>
    apiClient.post<User, UserPayload>(API_ENDPOINTS.users.base, payload, { token }),
  delete: (userId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.users.byId(userId), { token }),
  getOne: (userId: string, token: string) =>
    apiClient.get<User>(API_ENDPOINTS.users.byId(userId), { token }),
  list: listUsers,
  toggleActive: toggleUserActive,
  update: (userId: string, payload: UserPayload, token: string) =>
    apiClient.put<User, UserPayload>(API_ENDPOINTS.users.byId(userId), payload, { token }),
}
