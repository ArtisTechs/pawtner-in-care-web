import type { AddVolunteerForm } from '@/features/volunteers/constants/volunteer-list.constants'
import type { VolunteerPayload, VolunteerRecord } from '@/features/volunteers/types/volunteer-api'

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

  const timeMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})/)
  if (!timeMatch) {
    return ''
  }

  return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
}

const parseOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue || undefined
}

export const toTitleCase = (value: string) =>
  value.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`
  })

export const mapVolunteerToForm = (volunteer: VolunteerRecord): AddVolunteerForm => ({
  description: volunteer.description?.trim() ?? '',
  endDate: normalizeDateInput(volunteer.endDate),
  endTime: normalizeTimeInput(volunteer.endTime),
  link: volunteer.link?.trim() ?? '',
  photo: volunteer.photo?.trim() ?? '',
  startDate: normalizeDateInput(volunteer.startDate),
  startTime: normalizeTimeInput(volunteer.startTime),
  title: volunteer.title?.trim() ?? '',
})

export const buildVolunteerPayload = (form: AddVolunteerForm): VolunteerPayload => ({
  description: parseOptionalText(form.description),
  endDate: form.endDate.trim(),
  endTime: form.endTime.trim(),
  link: parseOptionalText(form.link),
  photo: parseOptionalText(form.photo),
  startDate: form.startDate.trim(),
  startTime: form.startTime.trim(),
  title: toTitleCase(form.title).trim(),
})
