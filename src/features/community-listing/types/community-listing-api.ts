export type CommunityPostVisibility = 'PUBLIC' | 'PRIVATE'
export type CommunityPostStatus = 'ACTIVE' | 'DELETED'
export type CommunityMediaType = 'IMAGE' | 'VIDEO'

export interface CommunityUserSummary {
  firstName?: string | null
  id: string
  lastName?: string | null
  middleName?: string | null
  profilePicture?: string | null
}

export interface CommunityPostHashtag {
  id?: string
  name?: string | null
  normalizedName?: string | null
}

export interface CommunityPostMedia {
  id?: string
  mediaType?: CommunityMediaType | string | null
  mediaUrl?: string | null
  sortOrder?: number | null
}

export interface CommunityPostMediaPayload {
  mediaType: CommunityMediaType
  mediaUrl: string
  sortOrder: number
}

export interface CommunityPostComment {
  commentId?: string
  content?: string | null
  createdAt?: string | null
  id?: string
  postId?: string | null
  updatedAt?: string | null
  user?: CommunityUserSummary | null
  userId?: string | null
}

export interface CommunityPostCommentPayload {
  content: string
}

export interface CommunityPostPayload {
  content?: string
  hashtags?: string[]
  media?: CommunityPostMediaPayload[]
  visibility: CommunityPostVisibility
}

export interface CommunityPostHiddenPayload {
  hidden: boolean
}

export interface CommunityPost {
  commentCount?: number | null
  content?: string | null
  createdAt?: string | null
  hidden?: boolean | null
  id?: string
  likeCount?: number | null
  likedByCurrentUser?: boolean | null
  media?: CommunityPostMedia[] | null
  postId?: string
  status?: CommunityPostStatus | string | null
  updatedAt?: string | null
  user?: CommunityUserSummary | null
  userId?: string | null
  visibility?: CommunityPostVisibility | string | null
  hashtags?: Array<CommunityPostHashtag | string> | null
  comments?: CommunityPostComment[] | null
}

export type CommunityPostListSortBy = 'commentCount' | 'createdAt' | 'likeCount' | 'updatedAt'
export type CommunityPostListSortDir = 'asc' | 'desc'

export interface CommunityPostListQuery {
  hashtag?: string
  ignorePagination?: boolean
  keyword?: string
  page?: number
  showHidden?: boolean
  size?: number
  sortBy?: CommunityPostListSortBy
  sortDir?: CommunityPostListSortDir
  userId?: string
}
