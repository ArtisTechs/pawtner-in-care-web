import type { ChartRange, DonationChartPoint, ReportChartPoint } from '@/features/dashboard/types/dashboard'

export type DashboardChartType = 'all' | 'donation' | 'report'

export interface DashboardChartsQuery {
  range?: ChartRange
  type?: DashboardChartType
}

export interface DashboardChartsResponse {
  range: ChartRange
  reportDetails: ReportChartPoint[]
  totalDonation: DonationChartPoint[]
}

export interface DashboardTopPostsQuery {
  top?: number
}

export interface DashboardTopPost {
  commentCount: number
  content: string
  createdAt: string
  likeCount: number
  postId: string
  userId: string
}
