import type { CompanySettings, CompanySettingsPayload } from '@/features/company-settings/types/company-settings-api'
import { ApiError } from '@/shared/api/api-error'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

const COMPANY_SETTINGS_ROOT_PATH = `${API_ENDPOINTS.companySettings.base}/`
const GENERIC_NOT_FOUND_MESSAGES = new Set(['not found', 'no message available'])

const shouldRetryWithoutTrailingSlash = (error: unknown) => {
  if (!(error instanceof ApiError) || error.status !== 404) {
    return false
  }

  const normalizedMessage = error.message.trim().toLowerCase()
  return GENERIC_NOT_FOUND_MESSAGES.has(normalizedMessage)
}

const requestCompanySettings = async <TResponse>(
  request: (path: string) => Promise<TResponse>,
) => {
  try {
    return await request(COMPANY_SETTINGS_ROOT_PATH)
  } catch (error) {
    if (!shouldRetryWithoutTrailingSlash(error)) {
      throw error
    }

    return request(API_ENDPOINTS.companySettings.base)
  }
}

export const companySettingsService = {
  get: (token: string) =>
    requestCompanySettings((path) => apiClient.get<CompanySettings>(path, { token })),
  upsert: (payload: CompanySettingsPayload, token: string, userId: string) =>
    requestCompanySettings((path) =>
      apiClient.put<CompanySettings, CompanySettingsPayload>(
        path,
        payload,
        {
          headers: { 'X-User-Id': userId },
          token,
        },
      ),
    ),
}
