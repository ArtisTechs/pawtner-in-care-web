import type { AddPaymentModeForm } from '@/features/payment-modes/constants/payment-mode-list.constants'
import type { PaymentMode, PaymentModePayload } from '@/features/payment-modes/types/payment-mode-api'

const parseOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue || undefined
}

export const mapPaymentModeToForm = (paymentMode: PaymentMode): AddPaymentModeForm => ({
  accountNumber: paymentMode.accountNumber?.trim() ?? '',
  name: paymentMode.name?.trim() ?? '',
  photoQr: paymentMode.photoQr?.trim() ?? '',
})

export const buildPaymentModePayload = (form: AddPaymentModeForm): PaymentModePayload => ({
  accountNumber: parseOptionalText(form.accountNumber),
  name: form.name.trim(),
  photoQr: parseOptionalText(form.photoQr),
})
