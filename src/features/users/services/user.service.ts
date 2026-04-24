import type {
  User,
  UserPayload,
  UserSortBy,
  UserSortDirection,
} from '@/features/users/types/user-api'
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
  shelterAssignment?: 'all' | 'unassigned' | 'assigned'
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

const updateActive = async (
  path: string,
  payload: Record<string, boolean>,
  token: string,
  headers?: Record<string, string>,
) => {
  return apiClient.put<User, Record<string, boolean>>(path, payload, { headers, token })
}

const toggleUserActive = async (
  userId: string,
  active: boolean,
  token: string,
  currentUserId?: string,
) => {
  const headers = currentUserId ? { 'X-User-Id': currentUserId } : undefined
  return updateActive(API_ENDPOINTS.users.byIdActive(userId), { active }, token, headers)
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
