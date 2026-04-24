export type GiftLogDeliveryType = 'PERSONAL' | 'SHIPPING' | (string & {})

export type GiftLogStatus = 'PENDING' | 'DELIVERED' | (string & {})

export interface GiftLogItemListing {
  id?: string | null
  itemName?: string | null
  photo?: string | null
}

export interface GiftLogAddressToSend {
  address?: string | null
  latitude?: number | null
  long?: number | null
  name?: string | null
}

export interface GiftLog {
  addressToSend?: GiftLogAddressToSend | null
  createdAt?: string | null
  createdDate?: string | null
  customItemName?: string | null
  deliveryType?: GiftLogDeliveryType | null
  id: string
  isCustomGiftBox?: boolean | null
  itemListing?: GiftLogItemListing | null
  itemListingId?: string | null
  itemSelected?: string | null
  message?: string | null
  photo?: string | null
  quantity?: number | null
  shippingCode?: string | null
  shippingCompanyName?: string | null
  status?: GiftLogStatus | null
  updatedAt?: string | null
  updatedDate?: string | null
}

export type GiftLogSortDir = 'asc' | 'desc'

export interface GiftLogListQuery {
  deliveryType?: GiftLogDeliveryType
  ignorePagination?: boolean
  page?: number
  search?: string
  size?: number
  sortBy?: 'id' | 'status' | 'deliveryType' | 'createdDate' | 'updatedDate' | (string & {})
  sortDir?: GiftLogSortDir
  status?: GiftLogStatus
}

export interface GiftLogListResult {
  isFirst: boolean
  isLast: boolean
  items: GiftLog[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

interface GiftLogWritePayloadBase {
  deliveryType: GiftLogDeliveryType
  message?: string
  photo?: string
  quantity?: number
  shippingCode?: string
  shippingCompanyName?: string
  status: GiftLogStatus
}

type GiftLogItemPayload = GiftLogWritePayloadBase & {
  customItemName?: never
  isCustomGiftBox?: false
  itemListingId: string
}

type GiftLogCustomItemPayload = GiftLogWritePayloadBase & {
  customItemName: string
  isCustomGiftBox?: false
  itemListingId?: never
}

type GiftLogCustomBoxPayload = GiftLogWritePayloadBase & {
  customItemName?: never
  isCustomGiftBox: true
  itemListingId?: never
}

export type CreateGiftLogPayload = GiftLogItemPayload | GiftLogCustomItemPayload | GiftLogCustomBoxPayload

export type UpdateGiftLogPayload = GiftLogItemPayload | GiftLogCustomItemPayload | GiftLogCustomBoxPayload
