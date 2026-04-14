import type {
  Achievement,
  AchievementAssignedUser,
  CreateAchievementPayload,
  ManualAchievementAssignmentPayload,
  ManualAchievementAssignmentResponse,
  AchievementListQuery,
  AchievementListResult,
  UserAchievement,
} from '@/features/achievements/types/achievement-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type AchievementListResponse =
  | Achievement[]
  | {
      content?: Achievement[] | null
      first?: boolean | null
      last?: boolean | null
      number?: number | null
      page?: number | null
      size?: number | null
      totalElements?: number | null
      totalPages?: number | null
    }

type UserAchievementListResponse =
  | unknown[]
  | {
      achievements?: unknown[] | null
      content?: unknown[] | null
      data?: unknown[] | null
      items?: unknown[] | null
      results?: unknown[] | null
      userAchievements?: unknown[] | null
    }

type AchievementAssignedUsersResponse =
  | {
      users?: unknown[] | null
    }
  | unknown[]

type JsonObject = Record<string, unknown>

const inFlightAchievementListRequests = new Map<string, Promise<AchievementListResult>>()
const inFlightUserAchievementRequests = new Map<string, Promise<UserAchievement[]>>()
const inFlightAchievementAssignedUsersRequests = new Map<string, Promise<AchievementAssignedUser[]>>()

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object'

const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

const readPath = (source: JsonObject, path: string): unknown => {
  const pathSegments = path.split('.')
  let currentValue: unknown = source

  for (const pathSegment of pathSegments) {
    if (!isObject(currentValue)) {
      return undefined
    }

    currentValue = currentValue[pathSegment]
  }

  return currentValue
}

const readFirstDefined = (source: JsonObject, paths: string[]) => {
  for (const path of paths) {
    const value = readPath(source, path)
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return undefined
}

const appendIfPresent = (params: URLSearchParams, key: string, value?: string | number | boolean) => {
  if (value === undefined || value === null || value === '') {
    return
  }

  params.set(key, String(value))
}

const buildListQueryString = (query?: AchievementListQuery) => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  appendIfPresent(params, 'search', query.search)
  appendIfPresent(params, 'code', query.code)
  appendIfPresent(params, 'title', query.title)
  appendIfPresent(params, 'category', query.category)
  appendIfPresent(params, 'rarity', query.rarity)
  appendIfPresent(params, 'isActive', query.isActive)
  appendIfPresent(params, 'assignmentType', query.assignmentType)
  appendIfPresent(params, 'page', query.page)
  appendIfPresent(params, 'size', query.size)
  appendIfPresent(params, 'sortBy', query.sortBy)
  appendIfPresent(params, 'sortDir', query.sortDir)
  appendIfPresent(params, 'ignorePagination', query.ignorePagination)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

const normalizeNumeric = (value: number | null | undefined, fallbackValue: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return fallbackValue
}

const normalizeAchievementListResponse = (
  value: AchievementListResponse,
  fallbackPage: number,
  fallbackSize: number,
): AchievementListResult => {
  if (Array.isArray(value)) {
    return {
      isFirst: true,
      isLast: true,
      items: value,
      page: 0,
      size: value.length,
      totalElements: value.length,
      totalPages: value.length ? 1 : 0,
    }
  }

  const items = value?.content && Array.isArray(value.content) ? value.content : []
  const page = normalizeNumeric(value?.number ?? value?.page, fallbackPage)
  const size = normalizeNumeric(value?.size, fallbackSize)
  const totalElements = normalizeNumeric(value?.totalElements, items.length)
  const totalPages = normalizeNumeric(
    value?.totalPages,
    size > 0 ? Math.max(1, Math.ceil(totalElements / size)) : items.length ? 1 : 0,
  )

  return {
    isFirst: Boolean(value?.first ?? page <= 0),
    isLast: Boolean(value?.last ?? page >= totalPages - 1),
    items,
    page,
    size,
    totalElements,
    totalPages,
  }
}

const listAchievements = (token: string, query?: AchievementListQuery) => {
  const queryString = buildListQueryString(query)
  const cacheKey = `${token}:${queryString}`
  const cachedRequest = inFlightAchievementListRequests.get(cacheKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const fallbackPage = query?.page ?? 0
  const fallbackSize = query?.size ?? 12
  const request = apiClient
    .get<AchievementListResponse>(`${API_ENDPOINTS.achievements.base}${queryString}`, { token })
    .then((response) => normalizeAchievementListResponse(response, fallbackPage, fallbackSize))

  inFlightAchievementListRequests.set(cacheKey, request)

  void request.finally(() => {
    inFlightAchievementListRequests.delete(cacheKey)
  })

  return request
}

const pickUserAchievementItems = (value: UserAchievementListResponse) => {
  if (Array.isArray(value)) {
    return value
  }

  if (Array.isArray(value?.content)) {
    return value.content
  }

  if (Array.isArray(value?.items)) {
    return value.items
  }

  if (Array.isArray(value?.results)) {
    return value.results
  }

  if (Array.isArray(value?.data)) {
    return value.data
  }

  if (Array.isArray(value?.achievements)) {
    return value.achievements
  }

  if (Array.isArray(value?.userAchievements)) {
    return value.userAchievements
  }

  return []
}

const mapUserAchievement = (
  value: unknown,
  index: number,
  fallbackUserId: string,
): UserAchievement | null => {
  if (!isObject(value)) {
    return null
  }

  const achievementPayload = readFirstDefined(value, ['achievement'])
  const achievement = isObject(achievementPayload) ? achievementPayload : {}
  const id =
    normalizeText(readFirstDefined(value, ['id', 'userAchievementId'])) ||
    `${fallbackUserId || 'user'}-achievement-${index + 1}`

  const achievementId =
    normalizeText(readFirstDefined(value, ['achievementId'])) ||
    normalizeText(readFirstDefined(achievement, ['id', 'achievementId'])) ||
    null

  const achievementCode =
    normalizeText(readFirstDefined(value, ['achievementCode', 'code'])) ||
    normalizeText(readFirstDefined(achievement, ['code', 'key'])) ||
    null

  const unlockedValue = readFirstDefined(value, ['isUnlocked', 'unlocked'])
  const isUnlocked =
    typeof unlockedValue === 'boolean'
      ? unlockedValue
      : typeof unlockedValue === 'string'
        ? unlockedValue.trim().toLowerCase() === 'true'
        : null

  return {
    achievementCode,
    achievementId,
    id,
    isUnlocked,
    unlockedAt: normalizeText(readFirstDefined(value, ['unlockedAt', 'completedAt'])) || null,
    userId: normalizeText(readFirstDefined(value, ['userId'])) || fallbackUserId || null,
  }
}

const normalizeUserAchievementsResponse = (
  value: UserAchievementListResponse,
  userId: string,
): UserAchievement[] =>
  pickUserAchievementItems(value)
    .map((item, index) => mapUserAchievement(item, index, userId))
    .filter((item): item is UserAchievement => Boolean(item))

const listUserAchievements = (userId: string, token: string) => {
  const cacheKey = `${token}:${userId}`
  const cachedRequest = inFlightUserAchievementRequests.get(cacheKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<UserAchievementListResponse>(API_ENDPOINTS.achievements.byUser(userId), { token })
    .then((response) => normalizeUserAchievementsResponse(response, userId))

  inFlightUserAchievementRequests.set(cacheKey, request)

  void request.finally(() => {
    inFlightUserAchievementRequests.delete(cacheKey)
  })

  return request
}

const pickAchievementAssignedUserItems = (value: AchievementAssignedUsersResponse) => {
  if (Array.isArray(value)) {
    return value
  }

  if (Array.isArray(value?.users)) {
    return value.users
  }

  return []
}

const mapAchievementAssignedUser = (value: unknown): AchievementAssignedUser | null => {
  if (!isObject(value)) {
    return null
  }

  const userPayload = readFirstDefined(value, ['user'])
  const user = isObject(userPayload) ? userPayload : {}
  const userAchievementId = normalizeText(readFirstDefined(value, ['userAchievementId', 'id']))
  const userId = normalizeText(readFirstDefined(value, ['userId', 'user.id']))

  if (!userAchievementId || !userId) {
    return null
  }

  return {
    createdAt: normalizeText(readFirstDefined(value, ['createdAt'])) || null,
    unlockedAt: normalizeText(readFirstDefined(value, ['unlockedAt'])) || null,
    user: {
      displayName: normalizeText(readFirstDefined(user, ['displayName', 'name'])) || null,
      email: normalizeText(readFirstDefined(user, ['email'])) || null,
      id: normalizeText(readFirstDefined(user, ['id'])) || null,
      profilePicture: normalizeText(readFirstDefined(user, ['profilePicture'])) || null,
    },
    userAchievementId,
    userId,
  }
}

const listAssignedUsersByAchievement = (achievementId: string, token: string) => {
  const cacheKey = `${token}:${achievementId}`
  const cachedRequest = inFlightAchievementAssignedUsersRequests.get(cacheKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<AchievementAssignedUsersResponse>(API_ENDPOINTS.achievements.assignedUsersById(achievementId), {
      token,
    })
    .then((response) => {
      const mappedUsers = pickAchievementAssignedUserItems(response)
        .map((item) => mapAchievementAssignedUser(item))
        .filter((item): item is AchievementAssignedUser => Boolean(item))

      const dedupedUsers = new Map<string, AchievementAssignedUser>()
      mappedUsers.forEach((item) => {
        if (!dedupedUsers.has(item.userId)) {
          dedupedUsers.set(item.userId, item)
        }
      })

      return Array.from(dedupedUsers.values())
    })

  inFlightAchievementAssignedUsersRequests.set(cacheKey, request)

  void request.finally(() => {
    inFlightAchievementAssignedUsersRequests.delete(cacheKey)
  })

  return request
}

export const achievementService = {
  assignToUser: (payload: ManualAchievementAssignmentPayload, token: string) =>
    apiClient.post<ManualAchievementAssignmentResponse, ManualAchievementAssignmentPayload>(
      API_ENDPOINTS.achievements.assign,
      payload,
      { token },
    ),
  create: (payload: CreateAchievementPayload, token: string) =>
    apiClient.post<Achievement, CreateAchievementPayload>(API_ENDPOINTS.achievements.base, payload, { token }),
  delete: (achievementId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.achievements.byId(achievementId), { token }),
  getOne: (achievementId: string, token: string) =>
    apiClient.get<Achievement>(API_ENDPOINTS.achievements.byId(achievementId), { token }),
  listAssignedUsersByAchievement,
  list: listAchievements,
  listUserAchievements,
  unassignFromUser: (userAchievementId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.achievements.assignmentById(userAchievementId), { token }),
  update: (achievementId: string, payload: CreateAchievementPayload, token: string) =>
    apiClient.put<Achievement, CreateAchievementPayload>(API_ENDPOINTS.achievements.byId(achievementId), payload, {
      token,
    }),
}
