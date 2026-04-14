import type {
  CreateItemListingPayload,
  FavoriteItemListingResponse,
  ItemListing,
  ItemListingBoxItem,
  ItemListingBoxResponse,
  ItemListingListQuery,
  ItemListingListResult,
} from '@/features/item-listings/types/item-listing-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type ItemListingListResponse =
  | ItemListing[]
  | {
      content?: ItemListing[] | null
      data?: ItemListing[] | null
      first?: boolean | null
      items?: ItemListing[] | null
      last?: boolean | null
      number?: number | null
      page?: number | null
      size?: number | null
      totalElements?: number | null
      totalPages?: number | null
    }

type CollectionResponse<T> =
  | T[]
  | {
      content?: T[] | null
      data?: T[] | null
      items?: T[] | null
    }

type ItemListingCollectionResponse = CollectionResponse<ItemListing>
type ItemListingBoxCollectionResponse = CollectionResponse<ItemListing | ItemListingBoxItem>

const inFlightItemListingRequests = new Map<string, Promise<ItemListingListResult>>()

const normalizeNumeric = (value: number | null | undefined, fallbackValue: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return fallbackValue
}

const normalizeRequestedQuantity = (quantity?: number) => {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 1) {
    return 1
  }

  return Math.floor(quantity)
}

const normalizeResponseQuantity = (quantity: number | null | undefined, fallbackValue: number) => {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    return fallbackValue
  }

  return Math.max(0, Math.floor(quantity))
}

const resolveCollection = <T>(response: CollectionResponse<T>): T[] => {
  if (Array.isArray(response)) {
    return response
  }

  if (response && Array.isArray(response.content)) {
    return response.content
  }

  if (response && Array.isArray(response.items)) {
    return response.items
  }

  if (response && Array.isArray(response.data)) {
    return response.data
  }

  return []
}

const appendIfPresent = (params: URLSearchParams, key: string, value?: string | number | boolean) => {
  if (value === undefined || value === null || value === '') {
    return
  }

  params.set(key, String(value))
}

const buildListQueryString = (query?: ItemListingListQuery) => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  appendIfPresent(params, 'search', query.search)
  appendIfPresent(params, 'itemName', query.itemName)
  appendIfPresent(params, 'category', query.category)
  appendIfPresent(params, 'type', query.type)
  appendIfPresent(params, 'isShow', query.isShow)
  appendIfPresent(params, 'page', query.page)
  appendIfPresent(params, 'size', query.size)
  appendIfPresent(params, 'sortBy', query.sortBy)
  appendIfPresent(params, 'sortDir', query.sortDir)
  appendIfPresent(params, 'ignorePagination', query.ignorePagination)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

const normalizeItemListingListResponse = (
  value: ItemListingListResponse,
  fallbackPage: number,
  fallbackSize: number,
): ItemListingListResult => {
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

  const items = value?.content && Array.isArray(value.content)
    ? value.content
    : value?.items && Array.isArray(value.items)
      ? value.items
      : value?.data && Array.isArray(value.data)
        ? value.data
        : []
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

const listItemListings = (token: string, query?: ItemListingListQuery) => {
  const queryString = buildListQueryString(query)
  const requestKey = `${token}:${queryString}`
  const cachedRequest = inFlightItemListingRequests.get(requestKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const fallbackPage = query?.page ?? 0
  const fallbackSize = query?.size ?? 12
  const request = apiClient
    .get<ItemListingListResponse>(`${API_ENDPOINTS.itemListings.base}${queryString}`, { token })
    .then((response) => normalizeItemListingListResponse(response, fallbackPage, fallbackSize))

  inFlightItemListingRequests.set(requestKey, request)
  void request.finally(() => {
    inFlightItemListingRequests.delete(requestKey)
  })

  return request
}

const resolveItemListingCollection = (response: ItemListingCollectionResponse): ItemListing[] => {
  return resolveCollection(response)
}

const resolveItemListingBoxCollection = (response: ItemListingBoxCollectionResponse): ItemListingBoxItem[] => {
  return resolveCollection(response).flatMap((value) => {
    if (value && typeof value === 'object' && 'item' in value) {
      if (!value.item || typeof value.item !== 'object') {
        return []
      }

      return [
        {
          item: value.item,
          quantity: normalizeResponseQuantity(value.quantity, 1),
        },
      ]
    }

    if (!value || typeof value !== 'object') {
      return []
    }

    return [
      {
        item: value,
        quantity: 1,
      },
    ]
  })
}

export const itemListingService = {
  addToBox: (itemListingId: string, token: string, userId: string, quantity = 1) =>
    apiClient.post<ItemListingBoxResponse, Record<string, never>>(
      API_ENDPOINTS.itemListings.boxById(itemListingId, normalizeRequestedQuantity(quantity)),
      {},
      {
        headers: { 'X-User-Id': userId },
        token,
      },
    ),
  addToFavorites: (itemListingId: string, token: string, userId: string) =>
    apiClient.post<FavoriteItemListingResponse, Record<string, never>>(
      API_ENDPOINTS.itemListings.favoritesById(itemListingId),
      {},
      {
        headers: { 'X-User-Id': userId },
        token,
      },
    ),
  create: (payload: CreateItemListingPayload, token: string) =>
    apiClient.post<ItemListing, CreateItemListingPayload>(API_ENDPOINTS.itemListings.base, payload, { token }),
  delete: (itemListingId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.itemListings.byId(itemListingId), { token }),
  getBoxItemsByUser: (userId: string, token: string) =>
    apiClient
      .get<ItemListingBoxCollectionResponse>(API_ENDPOINTS.itemListings.userBoxItems(userId), { token })
      .then(resolveItemListingBoxCollection),
  getFavoriteItemsByUser: (userId: string, token: string) =>
    apiClient
      .get<ItemListingCollectionResponse>(API_ENDPOINTS.itemListings.userFavoriteItems(userId), { token })
      .then(resolveItemListingCollection),
  getOne: (itemListingId: string, token: string) =>
    apiClient.get<ItemListing>(API_ENDPOINTS.itemListings.byId(itemListingId), { token }),
  list: listItemListings,
  removeFromBox: (itemListingId: string, token: string, userId: string) =>
    apiClient.delete<ItemListingBoxResponse>(API_ENDPOINTS.itemListings.boxById(itemListingId), {
      headers: { 'X-User-Id': userId },
      token,
    }),
  removeFromFavorites: (itemListingId: string, token: string, userId: string) =>
    apiClient.delete<FavoriteItemListingResponse>(API_ENDPOINTS.itemListings.favoritesById(itemListingId), {
      headers: { 'X-User-Id': userId },
      token,
    }),
  update: (itemListingId: string, payload: CreateItemListingPayload, token: string) =>
    apiClient.put<ItemListing, CreateItemListingPayload>(API_ENDPOINTS.itemListings.byId(itemListingId), payload, {
      token,
    }),
  updateShow: (itemListingId: string, isShow: boolean, token: string) =>
    apiClient.patch<ItemListing | null, Record<string, never>>(
      API_ENDPOINTS.itemListings.show(itemListingId, isShow),
      {},
      { token },
    ),
}
