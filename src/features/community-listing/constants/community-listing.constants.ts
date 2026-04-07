import type { CommunityPostVisibility } from '@/features/community-listing/types/community-listing-api'

export const LIST_INITIAL_BATCH_SIZE = 12
export const LIST_BATCH_SIZE = 12
export const LIST_SKELETON_ROW_COUNT = 8

export interface AddCommunityPostForm {
  content: string
  hashtags: string
  photos: string[]
  video: string
  visibility: CommunityPostVisibility
}

export const DEFAULT_ADD_COMMUNITY_POST_FORM: AddCommunityPostForm = {
  content: '',
  hashtags: '',
  photos: [''],
  video: '',
  visibility: 'PUBLIC',
}

export const VISIBILITY_LABELS: Record<CommunityPostVisibility, string> = {
  PRIVATE: 'Private',
  PUBLIC: 'Public',
}
