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

export type DashboardPostMediaType = 'IMAGE' | 'VIDEO'

export interface DashboardTopPostUser {
  id: string
  firstName: string | null
  middleName: string | null
  lastName: string | null
  profilePicture: string | null
}

export interface DashboardTopPostMedia {
  id: string
  mediaUrl: string
  mediaType: DashboardPostMediaType
  sortOrder: number
}

export interface DashboardTopPost {
  postId: string
  userId: string
  user: DashboardTopPostUser
  content: string | null
  visibility: string
  hidden: boolean
  status: string
  likeCount: number
  commentCount: number
  createdAt: string
  updatedAt: string
  media: DashboardTopPostMedia[]
}

export interface DashboardTopPostEntry {
  post: DashboardTopPost
  user: DashboardTopPostUser
}
