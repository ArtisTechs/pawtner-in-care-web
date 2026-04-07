import type {
  DashboardChartsQuery,
  DashboardChartsResponse,
  DashboardTopPost,
  DashboardTopPostsQuery,
} from '@/features/dashboard/types/dashboard-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

const buildChartsPath = (query?: DashboardChartsQuery) => {
  if (!query) {
    return API_ENDPOINTS.dashboard.charts
  }

  const params = new URLSearchParams()

  if (query.range) {
    params.set('range', query.range)
  }

  if (query.type) {
    params.set('type', query.type)
  }

  const queryString = params.toString()
  return queryString ? `${API_ENDPOINTS.dashboard.charts}?${queryString}` : API_ENDPOINTS.dashboard.charts
}

const buildTopPostsPath = (query?: DashboardTopPostsQuery) => {
  if (!query || query.top === undefined) {
    return API_ENDPOINTS.dashboard.topPosts
  }

  const params = new URLSearchParams({ top: String(query.top) })
  return `${API_ENDPOINTS.dashboard.topPosts}?${params.toString()}`
}

export const dashboardService = {
  getCharts: (token: string, query?: DashboardChartsQuery) =>
    apiClient.get<DashboardChartsResponse>(buildChartsPath(query), { token }),
  getTopPosts: (token: string, query?: DashboardTopPostsQuery) =>
    apiClient.get<DashboardTopPost[]>(buildTopPostsPath(query), { token }),
}
