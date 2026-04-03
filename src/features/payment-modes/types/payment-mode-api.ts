export interface PaymentModePayload {
  accountNumber?: string | null
  name: string
  photoQr?: string | null
}

export interface PaymentMode extends PaymentModePayload {
  createdAt?: string | null
  createdDate?: string | null
  id: string
  updatedAt?: string | null
  updatedDate?: string | null
}
