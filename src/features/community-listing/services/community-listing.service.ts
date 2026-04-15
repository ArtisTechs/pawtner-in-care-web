import type {
  CommunityPostComment,
  CommunityPostCommentPayload,
  CommunityPostHiddenPayload,
  CommunityPost,
  CommunityPostListQuery,
  CommunityPostPayload,
} from '@/features/community-listing/types/community-listing-api'
import { apiClient } from '@/shared/api/api-client'
import { API_ENDPOINTS } from '@/shared/api/api-endpoints'

type CommunityPostListResponse =
  | CommunityPost[]
  | { content?: CommunityPost[] | null; data?: CommunityPost[] | null }
  | { data?: { content?: CommunityPost[] | null } | CommunityPost[] | null }
type CommunityPostCommentListResponse =
  | CommunityPostComment[]
  | { content?: CommunityPostComment[] | null; data?: CommunityPostComment[] | null }
  | { data?: { content?: CommunityPostComment[] | null } | CommunityPostComment[] | null }

const inFlightCommunityPostListRequests = new Map<string, Promise<CommunityPost[]>>()

const resolveUserHeader = (currentUserId?: string) => {
  const normalizedUserId = currentUserId?.trim()
  if (!normalizedUserId) {
    return undefined
  }

  return {
    'X-User-Id': normalizedUserId,
  }
}

const normalizeListResponse = (value: CommunityPostListResponse): CommunityPost[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && 'content' in value && Array.isArray(value.content)) {
    return value.content
  }

  if (value && 'data' in value && Array.isArray(value.data)) {
    return value.data
  }

  if (
    value &&
    'data' in value &&
    value.data &&
    typeof value.data === 'object' &&
    !Array.isArray(value.data) &&
    'content' in value.data &&
    Array.isArray(value.data.content)
  ) {
    return value.data.content
  }

  return []
}

const normalizeCommentListResponse = (value: CommunityPostCommentListResponse): CommunityPostComment[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (value && 'content' in value && Array.isArray(value.content)) {
    return value.content
  }

  if (value && 'data' in value && Array.isArray(value.data)) {
    return value.data
  }

  if (
    value &&
    'data' in value &&
    value.data &&
    typeof value.data === 'object' &&
    !Array.isArray(value.data) &&
    'content' in value.data &&
    Array.isArray(value.data.content)
  ) {
    return value.data.content
  }

  return []
}

const buildListQueryString = (query?: CommunityPostListQuery) => {
  if (!query) {
    return ''
  }

  const params = new URLSearchParams()
  const appendIfPresent = (key: string, value?: string | number | boolean) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    params.set(key, String(value))
  }

  appendIfPresent('userId', query.userId)
  appendIfPresent('hashtag', query.hashtag)
  appendIfPresent('keyword', query.keyword)
  appendIfPresent('page', query.page)
  appendIfPresent('size', query.size)
  appendIfPresent('sortBy', query.sortBy)
  appendIfPresent('sortDir', query.sortDir)
  appendIfPresent('ignorePagination', query.ignorePagination)
  appendIfPresent('showHidden', query.showHidden)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

const listCommunityPosts = (token: string, query?: CommunityPostListQuery, currentUserId?: string) => {
  const queryString = buildListQueryString(query)
  const requestKey = `${token}::${queryString}::${currentUserId ?? ''}`
  const cachedRequest = inFlightCommunityPostListRequests.get(requestKey)
  if (cachedRequest) {
    return cachedRequest
  }

  const request = apiClient
    .get<CommunityPostListResponse>(`${API_ENDPOINTS.communityPosts.base}${queryString}`, {
      headers: resolveUserHeader(currentUserId),
      token,
    })
    .then(normalizeListResponse)

  inFlightCommunityPostListRequests.set(requestKey, request)

  void request.finally(() => {
    inFlightCommunityPostListRequests.delete(requestKey)
  })

  return request
}

export const communityListingService = {
  addReaction: (postId: string, token: string, currentUserId?: string) =>
    apiClient.post<CommunityPost | null, Record<string, never>>(
      API_ENDPOINTS.communityPosts.likes(postId),
      {},
      {
        headers: resolveUserHeader(currentUserId),
        token,
      },
    ),
  addComment: (
    postId: string,
    payload: CommunityPostCommentPayload,
    token: string,
    currentUserId?: string,
  ) =>
    apiClient.post<CommunityPostComment | CommunityPost, CommunityPostCommentPayload>(
      API_ENDPOINTS.communityPosts.comments(postId),
      payload,
      {
        headers: resolveUserHeader(currentUserId),
        token,
      },
    ),
  create: (payload: CommunityPostPayload, token: string, currentUserId?: string) =>
    apiClient.post<CommunityPost, CommunityPostPayload>(API_ENDPOINTS.communityPosts.base, payload, {
      headers: resolveUserHeader(currentUserId),
      token,
    }),
  delete: (postId: string, token: string, currentUserId?: string) =>
    apiClient.delete<null>(API_ENDPOINTS.communityPosts.byId(postId), {
      headers: resolveUserHeader(currentUserId),
      token,
    }),
  getOne: (postId: string, token: string, currentUserId?: string) =>
    apiClient.get<CommunityPost>(API_ENDPOINTS.communityPosts.byId(postId), {
      headers: resolveUserHeader(currentUserId),
      token,
    }),
  listComments: (postId: string, token: string, currentUserId?: string) =>
    apiClient
      .get<CommunityPostCommentListResponse>(API_ENDPOINTS.communityPosts.comments(postId), {
        headers: resolveUserHeader(currentUserId),
        token,
      })
      .then(normalizeCommentListResponse),
  list: listCommunityPosts,
  removeReaction: (postId: string, token: string, currentUserId?: string) =>
    apiClient.delete<CommunityPost | null>(API_ENDPOINTS.communityPosts.likes(postId), {
      headers: resolveUserHeader(currentUserId),
      token,
    }),
  setHidden: (postId: string, hidden: boolean, token: string, currentUserId?: string) =>
    apiClient.put<CommunityPost, CommunityPostHiddenPayload>(
      API_ENDPOINTS.communityPosts.hidden(postId),
      { hidden },
      {
        headers: resolveUserHeader(currentUserId),
        token,
      },
    ),
  update: (postId: string, payload: CommunityPostPayload, token: string, currentUserId?: string) =>
    apiClient.put<CommunityPost, CommunityPostPayload>(API_ENDPOINTS.communityPosts.byId(postId), payload, {
      headers: resolveUserHeader(currentUserId),
      token,
    }),
}
