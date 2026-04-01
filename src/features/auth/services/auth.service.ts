import { API_ENDPOINTS } from '@/shared/api/api-endpoints'
import { apiClient } from '@/shared/api/api-client'
import type {
  ApiMessageResponse,
  AuthSession,
  ConfirmOtpPayload,
  LoginPayload,
  ResetPasswordPayload,
  SendOtpPayload,
  SendOtpResponse,
} from '@/features/auth/types/auth-api'

export const authService = {
  confirmOtp: (payload: ConfirmOtpPayload) =>
    apiClient.post<ApiMessageResponse | null, ConfirmOtpPayload>(
      API_ENDPOINTS.auth.confirmOtp,
      payload,
    ),
  login: (payload: LoginPayload) =>
    apiClient.post<AuthSession, LoginPayload>(API_ENDPOINTS.auth.login, payload),
  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post<ApiMessageResponse | null, ResetPasswordPayload>(
      API_ENDPOINTS.auth.resetPassword,
      payload,
    ),
  sendOtp: (payload: SendOtpPayload) =>
    apiClient.post<SendOtpResponse | null, SendOtpPayload>(
      API_ENDPOINTS.auth.sendOtp,
      payload,
    ),
}
