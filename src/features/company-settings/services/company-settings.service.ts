import type {
  CompanySettings,
  CompanySettingsPayload,
  SupportFlowImportRequest,
} from '@/features/company-settings/types/company-settings-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

const COMPANY_SETTINGS_PATH = API_ENDPOINTS.companySettings.base
const SUPPORT_ADMIN_IMPORT_FLOW_PATH = API_ENDPOINTS.support.adminImportFlow

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
  importSupportFlow: (payload: SupportFlowImportRequest, token: string, userId: string) =>
    apiClient.post<unknown, SupportFlowImportRequest>(
      SUPPORT_ADMIN_IMPORT_FLOW_PATH,
      payload,
      {
        headers: { 'X-User-Id': userId },
        token,
      },
    ),
}
