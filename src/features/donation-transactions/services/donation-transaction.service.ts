import type {
  DonationTransaction,
  DonationTransactionListQuery,
  DonationTransactionListResult,
  DonationTransactionPayload,
  DonationTransactionTotalAmountQuery,
  DonationTransactionTotalAmountResponse,
} from '@/features/donation-transactions/types/donation-transaction-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type DonationTransactionListResponse =
  | DonationTransaction[]
  | {
      content?: DonationTransaction[] | null
      first?: boolean | null
      last?: boolean | null
      number?: number | null
      page?: number | null
      size?: number | null
      totalElements?: number | null
      totalPages?: number | null
    }

const inFlightDonationTransactionListRequests = new Map<string, Promise<DonationTransactionListResult>>()

const normalizeNumeric = (value: number | null | undefined, fallbackValue: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return fallbackValue
}

const normalizeDonationTransactionListResponse = (
  value: DonationTransactionListResponse,
  fallbackPage: number,
  fallbackSize: number,
): DonationTransactionListResult => {
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

  const items = value && Array.isArray(value.content) ? value.content : []
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

const buildListQueryString = (query?: DonationTransactionListQuery) => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  const appendIfPresent = (key: string, value?: string | number | boolean) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    params.set(key, String(value))
  }

  appendIfPresent('search', query.search)
  appendIfPresent('page', query.page)
  appendIfPresent('size', query.size)
  appendIfPresent('sortBy', query.sortBy)
  appendIfPresent('sortDir', query.sortDir)
  appendIfPresent('ignorePagination', query.ignorePagination)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

const listDonationTransactions = (token: string, query?: DonationTransactionListQuery) => {
  const queryString = buildListQueryString(query)
  const cacheKey = `${token}:${queryString}`
  const cachedRequest = inFlightDonationTransactionListRequests.get(cacheKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<DonationTransactionListResponse>(`${API_ENDPOINTS.donationTransactions.base}${queryString}`, { token })
    .then((response) =>
      normalizeDonationTransactionListResponse(response, query?.page ?? 0, query?.size ?? 20),
    )

  inFlightDonationTransactionListRequests.set(cacheKey, request)

  void request.finally(() => {
    inFlightDonationTransactionListRequests.delete(cacheKey)
  })

  return request
}

const buildTotalAmountPath = (query?: DonationTransactionTotalAmountQuery) => {
  if (!query) {
    return API_ENDPOINTS.donationTransactions.totalAmount
  }

  const params = new URLSearchParams()

  if (query.donationCampaignId?.trim()) {
    params.set('donationCampaignId', query.donationCampaignId.trim())
  }

  if (typeof query.minDonatedAmount === 'number' && Number.isFinite(query.minDonatedAmount)) {
    params.set('minDonatedAmount', String(query.minDonatedAmount))
  }

  const queryString = params.toString()
  return queryString
    ? `${API_ENDPOINTS.donationTransactions.totalAmount}?${queryString}`
    : API_ENDPOINTS.donationTransactions.totalAmount
}

export const donationTransactionService = {
  create: (payload: DonationTransactionPayload, token: string) =>
    apiClient.post<DonationTransaction, DonationTransactionPayload>(
      API_ENDPOINTS.donationTransactions.base,
      payload,
      { token },
    ),
  delete: (transactionId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.donationTransactions.byId(transactionId), { token }),
  getOne: (transactionId: string, token: string) =>
    apiClient.get<DonationTransaction>(API_ENDPOINTS.donationTransactions.byId(transactionId), { token }),
  list: listDonationTransactions,
  totalAmount: (token: string, query?: DonationTransactionTotalAmountQuery) =>
    apiClient.get<DonationTransactionTotalAmountResponse>(buildTotalAmountPath(query), { token }),
  update: (transactionId: string, payload: DonationTransactionPayload, token: string) =>
    apiClient.put<DonationTransaction, DonationTransactionPayload>(
      API_ENDPOINTS.donationTransactions.byId(transactionId),
      payload,
      { token },
    ),
}
