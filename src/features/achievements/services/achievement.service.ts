import type {
  Achievement,
  CreateAchievementPayload,
  ManualAchievementAssignmentPayload,
  ManualAchievementAssignmentResponse,
  AchievementListQuery,
  AchievementListResult,
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

const inFlightAchievementListRequests = new Map<string, Promise<AchievementListResult>>()

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
  appendIfPresent(params, 'isRepeatable', query.isRepeatable)
  appendIfPresent(params, 'visibility', query.visibility)
  appendIfPresent(params, 'assignmentType', query.assignmentType)
  appendIfPresent(params, 'triggerType', query.triggerType)
  appendIfPresent(params, 'ruleType', query.ruleType)
  appendIfPresent(params, 'startAtFrom', query.startAtFrom)
  appendIfPresent(params, 'startAtTo', query.startAtTo)
  appendIfPresent(params, 'endAtFrom', query.endAtFrom)
  appendIfPresent(params, 'endAtTo', query.endAtTo)
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
  list: listAchievements,
  update: (achievementId: string, payload: CreateAchievementPayload, token: string) =>
    apiClient.put<Achievement, CreateAchievementPayload>(API_ENDPOINTS.achievements.byId(achievementId), payload, {
      token,
    }),
}
