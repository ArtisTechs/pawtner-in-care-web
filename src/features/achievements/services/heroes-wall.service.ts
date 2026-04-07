import type {
  HeroesWallEntry,
  HeroesWallListQuery,
  HeroesWallListResult,
} from '@/features/achievements/types/heroes-wall-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type HeroesWallListResponse =
  | unknown[]
  | {
      content?: unknown[] | null
      data?: unknown[] | null
      first?: boolean | null
      items?: unknown[] | null
      last?: boolean | null
      number?: number | null
      page?: number | null
      results?: unknown[] | null
      rows?: unknown[] | null
      size?: number | null
      totalElements?: number | null
      totalPages?: number | null
    }

type JsonObject = Record<string, unknown>

const inFlightHeroesWallRequests = new Map<string, Promise<HeroesWallListResult>>()

const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object'

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

const parseNumeric = (value: unknown, fallbackValue = 0) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallbackValue
  }

  if (typeof value === 'string') {
    const normalizedValue = value.replace(/[^0-9.-]+/g, '')
    const parsedValue = Number.parseFloat(normalizedValue)
    return Number.isFinite(parsedValue) ? parsedValue : fallbackValue
  }

  return fallbackValue
}

const normalizeNumeric = (value: number | null | undefined, fallbackValue: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return fallbackValue
}

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const toNonNegativeInteger = (value: unknown, fallbackValue = 0) =>
  Math.max(0, Math.trunc(parseNumeric(value, fallbackValue)))

const appendIfPresent = (
  params: URLSearchParams,
  key: string,
  value?: string | number | null,
) => {
  if (value === undefined || value === null || value === '') {
    return
  }

  params.set(key, String(value))
}

const buildListQueryString = (query?: HeroesWallListQuery) => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  appendIfPresent(params, 'page', query.page)
  appendIfPresent(params, 'size', query.size)
  appendIfPresent(params, 'period', query.period)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

const mapHeroesWallEntry = (value: unknown, index: number): HeroesWallEntry | null => {
  if (!isObject(value)) {
    return null
  }

  const displayName =
    normalizeText(
      readFirstDefined(value, [
        'displayName',
        'userDisplayName',
        'fullName',
        'name',
        'username',
        'user.displayName',
        'user.fullName',
        'user.name',
        'user.username',
      ]),
    ) || 'Anonymous Hero'

  const userId = normalizeText(
    readFirstDefined(value, ['userId', 'user.userId', 'memberId', 'user.id']),
  )

  const payloadId = normalizeText(readFirstDefined(value, ['id']))
  const fallbackId = `${userId || toSlug(displayName) || 'hero'}-${index + 1}`
  const id = payloadId || fallbackId

  return {
    avatarUrl:
      normalizeText(
        readFirstDefined(value, [
          'avatarUrl',
          'imageUrl',
          'profileImage',
          'profileImageUrl',
          'profilePhoto',
          'profilePhotoUrl',
          'user.avatarUrl',
          'user.imageUrl',
          'user.profileImage',
          'user.profileImageUrl',
          'user.profilePhoto',
          'user.profilePhotoUrl',
        ]),
      ) || null,
    badgeCount: toNonNegativeInteger(
      readFirstDefined(value, ['badgeCount', 'totalBadges', 'achievementCount', 'achievementsUnlocked']),
    ),
    displayName,
    donatedAmount: Math.max(
      0,
      parseNumeric(
        readFirstDefined(value, [
          'donatedAmount',
          'totalDonated',
          'totalDonationAmount',
          'donationTotal',
          'amount',
          'donated',
        ]),
      ),
    ),
    id,
    points: Math.max(
      0,
      parseNumeric(readFirstDefined(value, ['points', 'totalPoints', 'score', 'totalScore'])),
    ),
    rank: toNonNegativeInteger(readFirstDefined(value, ['rank', 'position', 'leaderboardRank'])),
    userId: userId || id,
  }
}

const sortHeroes = (leftEntry: HeroesWallEntry, rightEntry: HeroesWallEntry) => {
  const leftHasRank = leftEntry.rank > 0
  const rightHasRank = rightEntry.rank > 0

  if (leftHasRank && rightHasRank && leftEntry.rank !== rightEntry.rank) {
    return leftEntry.rank - rightEntry.rank
  }

  if (leftHasRank !== rightHasRank) {
    return leftHasRank ? -1 : 1
  }

  if (leftEntry.donatedAmount !== rightEntry.donatedAmount) {
    return rightEntry.donatedAmount - leftEntry.donatedAmount
  }

  if (leftEntry.points !== rightEntry.points) {
    return rightEntry.points - leftEntry.points
  }

  return leftEntry.displayName.localeCompare(rightEntry.displayName)
}

const withNormalizedRanks = (entries: HeroesWallEntry[]) =>
  [...entries]
    .sort(sortHeroes)
    .map((entry, index) => ({
      ...entry,
      rank: entry.rank > 0 ? entry.rank : index + 1,
    }))

const pickListItems = (value: HeroesWallListResponse) => {
  if (Array.isArray(value)) {
    return value
  }

  if (Array.isArray(value?.content)) {
    return value.content
  }

  if (Array.isArray(value?.items)) {
    return value.items
  }

  if (Array.isArray(value?.rows)) {
    return value.rows
  }

  if (Array.isArray(value?.results)) {
    return value.results
  }

  if (Array.isArray(value?.data)) {
    return value.data
  }

  return []
}

const normalizeHeroesWallListResponse = (
  value: HeroesWallListResponse,
  fallbackPage: number,
  fallbackSize: number,
): HeroesWallListResult => {
  const rawItems = pickListItems(value)
  const mappedEntries = rawItems
    .map((entry, index) => mapHeroesWallEntry(entry, index))
    .filter((entry): entry is HeroesWallEntry => Boolean(entry))
  const items = withNormalizedRanks(mappedEntries)

  if (Array.isArray(value)) {
    return {
      isFirst: true,
      isLast: true,
      items,
      page: 0,
      size: items.length,
      totalElements: items.length,
      totalPages: items.length ? 1 : 0,
    }
  }

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

const listHeroesWall = (token: string, query?: HeroesWallListQuery) => {
  const queryString = buildListQueryString(query)
  const cacheKey = `${token}:${queryString}`
  const cachedRequest = inFlightHeroesWallRequests.get(cacheKey)

  if (cachedRequest) {
    return cachedRequest
  }

  const fallbackPage = query?.page ?? 0
  const fallbackSize = query?.size ?? 10

  const request = apiClient
    .get<HeroesWallListResponse>(`${API_ENDPOINTS.heroesWall.base}${queryString}`, { token })
    .then((response) => normalizeHeroesWallListResponse(response, fallbackPage, fallbackSize))

  inFlightHeroesWallRequests.set(cacheKey, request)

  void request.finally(() => {
    inFlightHeroesWallRequests.delete(cacheKey)
  })

  return request
}

export const heroesWallService = {
  list: listHeroesWall,
}
