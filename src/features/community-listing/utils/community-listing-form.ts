import type { AddCommunityPostForm } from '@/features/community-listing/constants/community-listing.constants'
import type {
  CommunityPost,
  CommunityPostHashtag,
  CommunityPostMedia,
  CommunityPostMediaPayload,
  CommunityPostPayload,
} from '@/features/community-listing/types/community-listing-api'

const parseOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue || undefined
}

const normalizeHashtag = (value: string) => {
  return value
    .trim()
    .replace(/^#+/, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
}

const toHashtagList = (value: string) => {
  const hashtagSet = new Set<string>()

  value
    .split(',')
    .map((entry) => normalizeHashtag(entry))
    .filter(Boolean)
    .forEach((entry) => {
      hashtagSet.add(entry)
    })

  return Array.from(hashtagSet)
}

const toOptionalMediaUrl = (media?: CommunityPostMedia | null) => {
  if (!media?.mediaUrl) {
    return ''
  }

  const trimmedMediaUrl = media.mediaUrl.trim()
  return trimmedMediaUrl || ''
}

const resolveHashtagLabel = (hashtag: CommunityPostHashtag | string) => {
  if (typeof hashtag === 'string') {
    return hashtag.trim()
  }

  return hashtag.name?.trim() || hashtag.normalizedName?.trim() || ''
}

export const toTitleCase = (value: string) =>
  value
    .split(/(\s+)/)
    .map((segment) => {
      if (!segment.trim()) {
        return segment
      }

      return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    })
    .join('')

export const resolvePostId = (post: CommunityPost) => {
  const id = post.postId?.trim() || post.id?.trim() || ''
  return id
}

export const resolveHashtags = (post: CommunityPost) => {
  if (!Array.isArray(post.hashtags)) {
    return []
  }

  return post.hashtags.map(resolveHashtagLabel).filter(Boolean)
}

export const resolvePrimaryMediaUrl = (post: CommunityPost, mediaType: 'IMAGE' | 'VIDEO') => {
  if (!Array.isArray(post.media)) {
    return ''
  }

  const matchedMedia = post.media.find((mediaItem) => {
    const normalizedMediaType = mediaItem.mediaType?.toString().trim().toUpperCase()
    return normalizedMediaType === mediaType
  })

  return toOptionalMediaUrl(matchedMedia)
}

export interface ResolvedCommunityPostMedia {
  mediaType: 'IMAGE' | 'VIDEO'
  mediaUrl: string
  sortOrder: number
}

export const resolvePostMediaList = (post: CommunityPost): ResolvedCommunityPostMedia[] => {
  if (!Array.isArray(post.media)) {
    return []
  }

  return post.media
    .map((mediaItem, index) => {
      const mediaUrl = toOptionalMediaUrl(mediaItem)
      const normalizedMediaType = mediaItem.mediaType?.toString().trim().toUpperCase()
      const mediaType = normalizedMediaType === 'VIDEO' ? 'VIDEO' : normalizedMediaType === 'IMAGE' ? 'IMAGE' : ''
      const sortOrder = typeof mediaItem.sortOrder === 'number' ? mediaItem.sortOrder : index

      if (!mediaUrl || !mediaType) {
        return null
      }

      return {
        mediaType,
        mediaUrl,
        sortOrder,
      } as ResolvedCommunityPostMedia
    })
    .filter((mediaItem): mediaItem is ResolvedCommunityPostMedia => Boolean(mediaItem))
    .sort((mediaA, mediaB) => mediaA.sortOrder - mediaB.sortOrder)
}

export const mapCommunityPostToForm = (post: CommunityPost): AddCommunityPostForm => {
  const imageUrls = resolvePostMediaList(post)
    .filter((mediaItem) => mediaItem.mediaType === 'IMAGE')
    .map((mediaItem) => mediaItem.mediaUrl)
    .slice(0, 5)

  return {
    content: post.content ?? '',
    hashtags: resolveHashtags(post).join(', '),
    photos: imageUrls.length > 0 ? imageUrls : [''],
    video: resolvePrimaryMediaUrl(post, 'VIDEO'),
    visibility: post.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
  }
}

export const buildCommunityPostPayload = (form: AddCommunityPostForm): CommunityPostPayload => {
  const mediaPayload: CommunityPostMediaPayload[] = []
  const imageUrls = form.photos
    .map((photoValue) => parseOptionalText(photoValue))
    .filter((photoValue): photoValue is string => Boolean(photoValue))
    .slice(0, 5)
  const videoUrl = parseOptionalText(form.video)

  imageUrls.forEach((photoUrl, photoIndex) => {
    mediaPayload.push({
      mediaType: 'IMAGE',
      mediaUrl: photoUrl,
      sortOrder: photoIndex,
    })
  })

  if (videoUrl) {
    mediaPayload.push({
      mediaType: 'VIDEO',
      mediaUrl: videoUrl,
      sortOrder: mediaPayload.length,
    })
  }

  const normalizedContent = parseOptionalText(toTitleCase(form.content))
  const hashtags = toHashtagList(form.hashtags)

  return {
    content: normalizedContent,
    hashtags: hashtags.length > 0 ? hashtags : undefined,
    media: mediaPayload.length > 0 ? mediaPayload : undefined,
    visibility: form.visibility,
  }
}

export const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return 'N/A'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }

  return parsedDate.toLocaleString('en-PH', {
    day: '2-digit',
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const resolveDisplayName = (post: CommunityPost) => {
  const user = post.user
  if (!user) {
    return post.userId?.trim() || 'N/A'
  }

  const fullName = [user.firstName, user.middleName, user.lastName]
    .map((namePart) => namePart?.trim() || '')
    .filter(Boolean)
    .join(' ')

  return fullName || user.id
}

export const toCountLabel = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '0'
  }

  return String(Math.max(0, value))
}
