import type { AddEventForm } from '@/features/events/constants/event-list.constants'
import type { EventPayload, EventRecord } from '@/features/events/types/event-api'

const normalizeDateInput = (value?: string | null) => {
  if (!value) {
    return ''
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  return trimmedValue.slice(0, 10)
}

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

const parseOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue || undefined
}

const parseOptionalNumber = (value: string) => {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return undefined
  }

  const parsedValue = Number.parseFloat(trimmedValue)
  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

export const toTitleCase = (value: string) =>
  value.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`
  })

export const mapEventToForm = (eventRecord: EventRecord): AddEventForm => ({
  address: eventRecord.address?.trim() ?? '',
  description: eventRecord.description?.trim() ?? '',
  endDate: normalizeDateInput(eventRecord.endDate),
  endTime: normalizeTimeInput(eventRecord.endTime) || normalizeTimeInput(eventRecord.time),
  latitude: Number.isFinite(eventRecord.latitude) ? String(eventRecord.latitude) : '',
  link: eventRecord.link?.trim() ?? '',
  location: eventRecord.location?.trim() ?? '',
  longitude: Number.isFinite(eventRecord.long) ? String(eventRecord.long) : '',
  photo: eventRecord.photo?.trim() ?? '',
  startDate: normalizeDateInput(eventRecord.startDate),
  startTime: normalizeTimeInput(eventRecord.startTime) || normalizeTimeInput(eventRecord.time),
  title: eventRecord.title?.trim() ?? '',
})

export const buildEventPayload = (form: AddEventForm): EventPayload => {
  const parsedLatitude = parseOptionalNumber(form.latitude)
  const parsedLongitude = parseOptionalNumber(form.longitude)
  const hasCoordinatePair = parsedLatitude !== undefined && parsedLongitude !== undefined

  return {
    address: parseOptionalText(form.address),
    description: parseOptionalText(form.description),
    endDate: form.endDate.trim(),
    endTime: form.endTime.trim(),
    latitude: hasCoordinatePair ? parsedLatitude : undefined,
    link: parseOptionalText(form.link),
    location: parseOptionalText(form.location),
    long: hasCoordinatePair ? parsedLongitude : undefined,
    photo: parseOptionalText(form.photo),
    startDate: form.startDate.trim(),
    startTime: form.startTime.trim(),
    title: toTitleCase(form.title).trim(),
  }
}
