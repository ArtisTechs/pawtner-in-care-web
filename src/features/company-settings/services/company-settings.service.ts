import type { CompanySettings, CompanySettingsPayload } from '@/features/company-settings/types/company-settings-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

export const companySettingsService = {
  get: (token: string) => apiClient.get<CompanySettings>(API_ENDPOINTS.companySettings.base, { token }),
  upsert: (payload: CompanySettingsPayload, token: string, userId: string) =>
    apiClient.put<CompanySettings, CompanySettingsPayload>(
      API_ENDPOINTS.companySettings.base,
      payload,
      {
        headers: { 'X-User-Id': userId },
        token,
      },
    ),
}
