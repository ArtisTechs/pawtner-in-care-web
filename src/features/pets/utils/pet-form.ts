import type { AddPetForm } from '@/features/pets/constants/pet-list.constants'
import type { Pet, PetPayload } from '@/features/pets/types/pet-api'

export type AnimalType = 'dog' | 'cat'

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

const parseOptionalNumber = (value: string) => {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return undefined
  }

  const parsedValue = Number.parseFloat(trimmedValue)
  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

const parseOptionalText = (value: string) => {
  const trimmedValue = value.trim()
  return trimmedValue || undefined
}

export const toProperNameCase = (value: string) =>
  value.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`
  })

export const mapPetToForm = (pet: Pet): AddPetForm => ({
  adoptionDate: normalizeDateInput(pet.adoptionDate),
  birthDate: normalizeDateInput(pet.birthDate),
  description: pet.description ?? '',
  gender: pet.gender || 'Male',
  height: pet.height === undefined || pet.height === null ? '' : String(pet.height),
  isVaccinated: Boolean(pet.isVaccinated),
  name: pet.name || '',
  photo: pet.photo ?? '',
  race: pet.race ?? '',
  rescuedDate: normalizeDateInput(pet.rescuedDate),
  status: pet.status,
  type: pet.type || 'Dog',
  videos: pet.videos ?? '',
  weight: pet.weight === undefined || pet.weight === null ? '' : String(pet.weight),
})

export const resolveAnimalFromType = (type: string): AnimalType => {
  const normalizedType = type.trim().toLowerCase()

  if (normalizedType.includes('cat')) {
    return 'cat'
  }

  if (normalizedType.includes('dog')) {
    return 'dog'
  }

  return 'dog'
}

export const buildPetPayload = (form: AddPetForm): PetPayload => ({
  adoptionDate: form.status === 'ADOPTED' ? parseOptionalText(form.adoptionDate) : undefined,
  birthDate: parseOptionalText(form.birthDate),
  description: parseOptionalText(form.description),
  gender: form.gender.trim(),
  height: parseOptionalNumber(form.height),
  isVaccinated: form.isVaccinated,
  name: toProperNameCase(form.name).trim(),
  photo: parseOptionalText(form.photo),
  race: parseOptionalText(toProperNameCase(form.race)),
  rescuedDate: parseOptionalText(form.rescuedDate),
  status: form.status,
  type: form.type.trim(),
  videos: parseOptionalText(form.videos),
  weight: parseOptionalNumber(form.weight),
})
