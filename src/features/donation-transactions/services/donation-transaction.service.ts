import type {
  DonationTransaction,
  DonationTransactionPayload,
} from '@/features/donation-transactions/types/donation-transaction-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type DonationTransactionListResponse = DonationTransaction[] | { content?: DonationTransaction[] | null }

const inFlightDonationTransactionListRequests = new Map<string, Promise<DonationTransaction[]>>()

const normalizeDonationTransactionListResponse = (value: DonationTransactionListResponse) => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const listDonationTransactions = (token: string) => {
  const cachedRequest = inFlightDonationTransactionListRequests.get(token)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<DonationTransactionListResponse>(API_ENDPOINTS.donationTransactions.base, { token })
    .then(normalizeDonationTransactionListResponse)

  inFlightDonationTransactionListRequests.set(token, request)

  void request.finally(() => {
    inFlightDonationTransactionListRequests.delete(token)
  })

  return request
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
  update: (transactionId: string, payload: DonationTransactionPayload, token: string) =>
    apiClient.put<DonationTransaction, DonationTransactionPayload>(
      API_ENDPOINTS.donationTransactions.byId(transactionId),
      payload,
      { token },
    ),
}
