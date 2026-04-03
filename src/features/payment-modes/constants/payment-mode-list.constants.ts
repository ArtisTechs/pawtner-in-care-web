export const LIST_INITIAL_BATCH_SIZE = 12
export const LIST_BATCH_SIZE = 12
export const LIST_SKELETON_ROW_COUNT = 8

export interface AddPaymentModeForm {
  accountNumber: string
  name: string
  photoQr: string
}

export const DEFAULT_ADD_PAYMENT_MODE_FORM: AddPaymentModeForm = {
  accountNumber: '',
  name: '',
  photoQr: '',
}
