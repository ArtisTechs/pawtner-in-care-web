import type { CompanySettings, CompanySettingsPayload } from '@/features/company-settings/types/company-settings-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

const COMPANY_SETTINGS_PATH = API_ENDPOINTS.companySettings.base

export const companySettingsService = {
  get: (token: string) => apiClient.get<CompanySettings>(COMPANY_SETTINGS_PATH, { token }),
  upsert: (payload: CompanySettingsPayload, token: string, userId: string) =>
    apiClient.put<CompanySettings, CompanySettingsPayload>(
      COMPANY_SETTINGS_PATH,
      payload,
      {
        headers: { 'X-User-Id': userId },
        token,
      },
    ),
}
