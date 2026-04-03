import type { PaymentMode, PaymentModePayload } from '@/features/payment-modes/types/payment-mode-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

const inFlightPaymentModeListRequests = new Map<string, Promise<PaymentMode[]>>()

type PaymentModeListResponse = PaymentMode[] | { content?: PaymentMode[] | null }

const normalizePaymentModeListResponse = (value: PaymentModeListResponse): PaymentMode[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && Array.isArray(value.content)) {
    return value.content
  }

  return []
}

const listPaymentModes = (token: string) => {
  const cachedRequest = inFlightPaymentModeListRequests.get(token)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<PaymentModeListResponse>(API_ENDPOINTS.paymentModes.base, { token })
    .then(normalizePaymentModeListResponse)

  inFlightPaymentModeListRequests.set(token, request)

  void request.finally(() => {
    inFlightPaymentModeListRequests.delete(token)
  })

  return request
}

export const paymentModeService = {
  create: (payload: PaymentModePayload, token: string) =>
    apiClient.post<PaymentMode, PaymentModePayload>(API_ENDPOINTS.paymentModes.base, payload, {
      token,
    }),
  delete: (paymentModeId: string, token: string) =>
    apiClient.delete<null>(API_ENDPOINTS.paymentModes.byId(paymentModeId), { token }),
  getOne: (paymentModeId: string, token: string) =>
    apiClient.get<PaymentMode>(API_ENDPOINTS.paymentModes.byId(paymentModeId), { token }),
  list: listPaymentModes,
  update: (paymentModeId: string, payload: PaymentModePayload, token: string) =>
    apiClient.put<PaymentMode, PaymentModePayload>(
      API_ENDPOINTS.paymentModes.byId(paymentModeId),
      payload,
      { token },
    ),
}
