export type GiftLogDeliveryType = 'PERSONAL' | 'SHIPPING' | (string & {})

export type GiftLogStatus = 'PENDING' | 'DELIVERED' | (string & {})

export interface GiftLogItemListing {
  id?: string | null
  itemName?: string | null
  photo?: string | null
}

export interface GiftLog {
  createdAt?: string | null
  createdDate?: string | null
  customItemName?: string | null
  deliveryType?: GiftLogDeliveryType | null
  id: string
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

export interface CreateGiftLogPayload {
  customItemName?: string
  deliveryType: GiftLogDeliveryType
  itemListingId?: string
  message?: string
  photo?: string
  quantity?: number
  shippingCode?: string
  shippingCompanyName?: string
  status: GiftLogStatus
}

export interface UpdateGiftLogPayload {
  customItemName?: string
  deliveryType: GiftLogDeliveryType
  itemListingId?: string
  message?: string
  photo?: string
  quantity?: number
  shippingCode?: string
  shippingCompanyName?: string
  status: GiftLogStatus
}
