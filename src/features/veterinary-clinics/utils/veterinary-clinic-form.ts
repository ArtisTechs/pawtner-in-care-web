import type { AddVeterinaryClinicForm } from '@/features/veterinary-clinics/constants/veterinary-clinic-list.constants'
import type {
  VeterinaryClinic,
  VeterinaryClinicPayload,
} from '@/features/veterinary-clinics/types/veterinary-clinic-api'
import { normalizeContactNumber } from '@/shared/lib/validation/contact'

const parseOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue || undefined
}

const parseRequiredNumber = (value: string) => {
  const trimmedValue = value.trim()
  const parsedValue = Number.parseFloat(trimmedValue)
  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

const clampRating = (value: number) => Math.min(5, Math.max(0, value))

const parseRatingNumber = (value?: string | null) => {
  const trimmedValue = value?.trim() ?? ''
  if (!trimmedValue) {
    return undefined
  }

  const ratingMatch = trimmedValue.match(/\d+(\.\d+)?/)
  if (!ratingMatch) {
    return undefined
  }

  const parsedValue = Number.parseFloat(ratingMatch[0])
  return Number.isFinite(parsedValue) ? clampRating(parsedValue) : undefined
}

const parseListValues = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeListValues = (values: string[]) =>
  values
    .map((item) => item.trim())
    .filter(Boolean)

const normalizeContactNumberValues = (values: string[]) =>
  values
    .map((item) => normalizeContactNumber(item))
    .filter(Boolean)

const VALID_OPEN_DAYS = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
])

const parseOpenDays = (value: string) =>
  parseListValues(value)
    .map((item) => item.toLowerCase())
    .filter((item) => VALID_OPEN_DAYS.has(item))

const normalizeTimeInput = (value?: string | null) => {
  if (!value) {
    return ''
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  if (/^\d{2}:\d{2}$/.test(trimmedValue)) {
    return trimmedValue
  }

  const timeMatch = trimmedValue.match(/\b(\d{2}):(\d{2})\b/)
  if (!timeMatch) {
    return ''
  }

  return `${timeMatch[1]}:${timeMatch[2]}`
}

const mapListToTextarea = (values?: string[] | null) => {
  if (!Array.isArray(values) || values.length === 0) {
    return ''
  }

  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n')
}

export const mapVeterinaryClinicToForm = (
  clinic: VeterinaryClinic,
): AddVeterinaryClinicForm => {
  const parsedRating = parseRatingNumber(clinic.ratings)
  const normalizedContactNumbers = normalizeListValues(clinic.contactNumbers ?? [])

  return {
    contactNumbers: normalizedContactNumbers.length > 0 ? normalizedContactNumbers : [''],
    description: clinic.description ?? '',
    latitude: Number.isFinite(clinic.latitude) ? String(clinic.latitude) : '',
    locationAddress: clinic.locationAddress ?? '',
    logo: clinic.logo ?? '',
    longitude: Number.isFinite(clinic.long) ? String(clinic.long) : '',
    name: clinic.name ?? '',
    openDays: mapListToTextarea(clinic.openDays),
    photo: clinic.photos?.[0] ?? '',
    closingTime: normalizeTimeInput(clinic.closingTime),
    openingTime: normalizeTimeInput(clinic.openingTime),
    ratings: parsedRating === undefined ? '' : parsedRating.toFixed(1),
    video: clinic.videos?.[0] ?? '',
  }
}

export const buildVeterinaryClinicPayload = (
  form: AddVeterinaryClinicForm,
): VeterinaryClinicPayload | null => {
  const parsedLongitude = parseRequiredNumber(form.longitude)
  const parsedLatitude = parseRequiredNumber(form.latitude)

  if (parsedLongitude === undefined || parsedLatitude === undefined) {
    return null
  }

  const contactNumbers = normalizeContactNumberValues(form.contactNumbers)
  const uploadedPhoto = parseOptionalText(form.photo)
  const uploadedVideo = parseOptionalText(form.video)
  const parsedRating = parseRatingNumber(form.ratings)
  const photos = uploadedPhoto ? [uploadedPhoto] : []
  const videos = uploadedVideo ? [uploadedVideo] : []
  const openingTime = normalizeTimeInput(form.openingTime)
  const closingTime = normalizeTimeInput(form.closingTime)
  const openDays = parseOpenDays(form.openDays)

  return {
    contactNumbers: contactNumbers.length > 0 ? contactNumbers : undefined,
    description: parseOptionalText(form.description),
    latitude: parsedLatitude,
    locationAddress: form.locationAddress.trim(),
    logo: parseOptionalText(form.logo),
    long: parsedLongitude,
    name: form.name.trim(),
    openDays: openDays.length > 0 ? openDays : undefined,
    closingTime: closingTime || undefined,
    openingTime: openingTime || undefined,
    photos: photos.length > 0 ? photos : undefined,
    ratings: parsedRating === undefined ? undefined : `${parsedRating.toFixed(1)}/5`,
    videos: videos.length > 0 ? videos : undefined,
  }
}
