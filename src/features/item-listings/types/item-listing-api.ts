export type ItemListingSortDir = 'asc' | 'desc'
export type ItemListingType = 'dogs' | 'cats' | 'shelter' | 'care box'

export interface ItemListing {
  categories?: string[] | null
  createdAt?: string | null
  details?: string | null
  id: string
  isShow?: boolean | null
  itemName?: string | null
  photo?: string | null
  type?: ItemListingType | null
  updatedAt?: string | null
}

export interface ItemListingListQuery {
  category?: string
  ignorePagination?: boolean
  isShow?: boolean
  itemName?: string
  page?: number
  search?: string
  size?: number
  sortBy?: 'id' | 'itemName' | 'type' | 'isShow' | (string & {})
  sortDir?: ItemListingSortDir
  type?: ItemListingType | (string & {})
}

export interface ItemListingListResult {
  isFirst: boolean
  isLast: boolean
  items: ItemListing[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface CreateItemListingPayload {
  categories?: string[]
  details?: string
  isShow?: boolean
  itemName: string
  photo?: string
  type?: ItemListingType
}

export interface UpdateItemShowPayload {
  isShow: boolean
}

export interface FavoriteItemListingResponse {
  favorited: boolean
  itemListingId: string
  userId: string
}

export interface ItemListingBoxResponse {
  inBox: boolean
  itemListingId: string
  quantity: number
  userId: string
}

export interface ItemListingBoxItem {
  item: ItemListing
  quantity: number
}
