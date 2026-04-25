import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { FaEdit, FaPlus, FaSave, FaTimes, FaTrashAlt, FaUpload } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { getAuthSessionUserId, resolveDashboardAccessRole } from '@/features/auth/utils/auth-utils'
import { companySettingsService } from '@/features/company-settings/services/company-settings.service'
import type {
  CompanySettings,
  CompanySettingsAdminUser,
  CompanySettingsPayload,
  SupportFlowImportRequest,
} from '@/features/company-settings/types/company-settings-api'
import { userService } from '@/features/users/services/user.service'
import type { User } from '@/features/users/types/user-api'
import { resolveUserDisplayName, resolveUserRoleValue } from '@/features/users/utils/user-form'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { ApiError, getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import LocationPickerMap from '@/shared/components/maps/LocationPickerMap/LocationPickerMap'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import { localStorageService } from '@/shared/lib/storage/local-storage'
import { toTitleCase } from '@/shared/lib/text/title-case'
import { isValidContactNumber, isValidEmail, normalizeContactNumber } from '@/shared/lib/validation/contact'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './CompanySettingsPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'settings'
const DEFAULT_CONTACT_NUMBER = ''
const DEFAULT_EMAIL_ADDRESS = ''
const DEFAULT_LINK_URL = ''
const DEFAULT_MESSAGE_ADMIN_USER = ''
const DEFAULT_TOTAL_AVAILABLE_SPACE_FOR_PETS = ''
const DEFAULT_MAX_RESCUES_PER_DAY = ''
const HTTP_URL_PATTERN = /^https?:\/\/.+/i
const SUPPORT_CHAT_IMPORT_STORAGE_KEY = '@pawtner/company-settings/support-chat-import'
const MAX_SUPPORT_CHAT_IMPORT_FILE_SIZE_BYTES = 1_000_000
const SUPPORT_CHAT_IMPORT_ACCEPTED_EXTENSIONS = ['.json'] as const

type CompanyAddressForm = {
  address: string
  latitude: string
  long: string
  name: string
}

type CompanyAddressFormErrors = {
  address?: string
  latitude?: string
  long?: string
  name?: string
}

type CompanySettingsFormErrors = {
  addresses?: string
  addressItems: CompanyAddressFormErrors[]
  contactNumber?: string
  emailAddress?: string
  linkUrl?: string
  maxRescuesPerDay?: string
  totalAvailableSpaceForPets?: string
}

type AdminContactOption = {
  label: string
  value: string
}

type SupportChatImportRecord = {
  fileName: string
  importedAt: string
  size: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const getStringField = (value: unknown, keys: string[]) => {
  if (!isRecord(value)) {
    return ''
  }

  for (const key of keys) {
    const candidate = value[key]

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  return ''
}

const resolveShelterName = (user: unknown) => {
  const directShelterName = getStringField(user, ['shelterName'])
  if (directShelterName) {
    return directShelterName
  }

  if (!isRecord(user)) {
    return ''
  }

  return getStringField(user.shelter, ['name', 'shelterName'])
}

const createEmptyAddress = (): CompanyAddressForm => ({
  address: '',
  latitude: '',
  long: '',
  name: '',
})

const createEmptyFormErrors = (): CompanySettingsFormErrors => ({
  addressItems: [],
})

const mapSettingsToForm = (settings: CompanySettings) => ({
  addresses:
    settings.addresses?.map((address) => ({
      address: address.address?.trim() ?? '',
      latitude: Number.isFinite(address.latitude) ? String(address.latitude) : '',
      long: Number.isFinite(address.long) ? String(address.long) : '',
      name: address.name?.trim() ?? '',
    })) ?? [createEmptyAddress()],
  contactNumber: settings.contactNumber?.trim() ?? DEFAULT_CONTACT_NUMBER,
  emailAddress: settings.emailAddress?.trim() ?? DEFAULT_EMAIL_ADDRESS,
  linkUrl: settings.linkUrl?.trim() ?? DEFAULT_LINK_URL,
  maxRescuesPerDay: Number.isFinite(settings.maxRescuesPerDay) ? String(settings.maxRescuesPerDay) : DEFAULT_MAX_RESCUES_PER_DAY,
  messageAdminUser: settings.messageAdminUser?.id?.trim() ?? DEFAULT_MESSAGE_ADMIN_USER,
  totalAvailableSpaceForPets: Number.isFinite(settings.totalAvailableSpaceForPets)
    ? String(settings.totalAvailableSpaceForPets)
    : DEFAULT_TOTAL_AVAILABLE_SPACE_FOR_PETS,
})

const parseCoordinate = (value: string) => Number.parseFloat(value.trim())
const parseWholeNumber = (value: string) => Number.parseInt(value.trim(), 10)
const isValidLongitude = (value: number) => value >= -180 && value <= 180
const isValidLatitude = (value: number) => value >= -90 && value <= 90
const hasAcceptedSupportChatImportExtension = (fileName: string) =>
  SUPPORT_CHAT_IMPORT_ACCEPTED_EXTENSIONS.some((extension) => fileName.toLowerCase().endsWith(extension))
const isSupportFlowImportRequest = (value: unknown): value is SupportFlowImportRequest =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const formatFileSize = (sizeInBytes: number) => {
  if (!Number.isFinite(sizeInBytes) || sizeInBytes < 0) {
    return '0 B'
  }

  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`
  }

  const sizeInKilobytes = sizeInBytes / 1024

  if (sizeInKilobytes < 1024) {
    return `${sizeInKilobytes.toFixed(1)} KB`
  }

  return `${(sizeInKilobytes / 1024).toFixed(1)} MB`
}
const formatImportedAt = (value: string) => {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    return 'N/A'
  }

  return new Date(timestamp).toLocaleString()
}
const normalizeSupportChatImportRecord = (value: unknown): SupportChatImportRecord | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const typedValue = value as Partial<SupportChatImportRecord>

  if (
    typeof typedValue.fileName !== 'string' ||
    typeof typedValue.importedAt !== 'string' ||
    typeof typedValue.size !== 'number'
  ) {
    return null
  }

  const normalizedFileName = typedValue.fileName.trim()
  const normalizedImportedAt = typedValue.importedAt.trim()

  if (!normalizedFileName || !normalizedImportedAt) {
    return null
  }

  if (!Number.isFinite(typedValue.size) || typedValue.size < 0) {
    return null
  }

  return {
    fileName: normalizedFileName,
    importedAt: normalizedImportedAt,
    size: typedValue.size,
  }
}
const resolveAdminContactSummary = (contact: CompanySettingsAdminUser | null | undefined) => {
  if (!contact) {
    return 'No admin contact found.'
  }

  const fullName = [contact.firstName, contact.middleName, contact.lastName]
    .map((namePart) => namePart?.trim() ?? '')
    .filter((namePart) => Boolean(namePart))
    .join(' ')

  const email = contact.email?.trim() ?? ''

  if (fullName && email) {
    return `${fullName} (${email})`
  }

  return fullName || email || contact.id
}
const resolveAdminContactLabel = (user: User) => {
  const fullName = resolveUserDisplayName(user)
  const email = user.email?.trim() ?? ''

  if (fullName && email) {
    return `${fullName} (${email})`
  }

  return fullName || email || user.id
}

interface CompanySettingsPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function CompanySettingsPage({ onLogout, session }: CompanySettingsPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })

  const [contactNumber, setContactNumber] = useState(DEFAULT_CONTACT_NUMBER)
  const [emailAddress, setEmailAddress] = useState(DEFAULT_EMAIL_ADDRESS)
  const [linkUrl, setLinkUrl] = useState(DEFAULT_LINK_URL)
  const [messageAdminUser, setMessageAdminUser] = useState(DEFAULT_MESSAGE_ADMIN_USER)
  const [totalAvailableSpaceForPets, setTotalAvailableSpaceForPets] = useState(DEFAULT_TOTAL_AVAILABLE_SPACE_FOR_PETS)
  const [maxRescuesPerDay, setMaxRescuesPerDay] = useState(DEFAULT_MAX_RESCUES_PER_DAY)
  const [addresses, setAddresses] = useState<CompanyAddressForm[]>([createEmptyAddress()])
  const [adminContactOptions, setAdminContactOptions] = useState<AdminContactOption[]>([])
  const [isLoadingAdminContactOptions, setIsLoadingAdminContactOptions] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [settingsRecord, setSettingsRecord] = useState<CompanySettings | null>(null)
  const [formErrors, setFormErrors] = useState<CompanySettingsFormErrors>(createEmptyFormErrors())
  const [supportChatImportFile, setSupportChatImportFile] = useState<File | null>(null)
  const [lastSupportChatImport, setLastSupportChatImport] = useState<SupportChatImportRecord | null>(null)
  const [isSupportImportConfirmOpen, setIsSupportImportConfirmOpen] = useState(false)
  const [isImportingSupportChats, setIsImportingSupportChats] = useState(false)
  const [isSupportImportDragOver, setIsSupportImportDragOver] = useState(false)
  const accessToken = session?.accessToken?.trim() ?? ''
  const userId = getAuthSessionUserId(session?.user)
  const resolvedRole = resolveDashboardAccessRole(session ?? null)
  const canManageCompanySettings = resolvedRole === 'ADMIN' || resolvedRole === 'SYSTEM_ADMIN'
  const canImportSupportFlow = resolvedRole === 'SYSTEM_ADMIN'
  const supportChatImportInputRef = useRef<HTMLInputElement | null>(null)
  const supportChatImportDragDepthRef = useRef(0)

  const clearFormErrors = useCallback(() => {
    setFormErrors(createEmptyFormErrors())
  }, [])

  const clearAddressItemErrors = useCallback(
    (index: number, fields?: Array<keyof CompanyAddressFormErrors>) => {
      setFormErrors((currentErrors) => {
        const existingItemErrors = currentErrors.addressItems[index]
        if (!existingItemErrors) {
          return currentErrors
        }

        const nextAddressItems = [...currentErrors.addressItems]
        const nextItemErrors = { ...existingItemErrors }

        if (fields && fields.length > 0) {
          for (const field of fields) {
            nextItemErrors[field] = undefined
          }
        } else {
          nextAddressItems[index] = {}
          return {
            ...currentErrors,
            addressItems: nextAddressItems,
          }
        }

        nextAddressItems[index] = nextItemErrors
        return {
          ...currentErrors,
          addressItems: nextAddressItems,
        }
      })
    },
    [],
  )

  const filteredAddresses = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    if (!normalizedSearch) {
      return addresses.map((address, index) => ({ address, index }))
    }

    return addresses
      .map((address, index) => ({ address, index }))
      .filter(({ address }) => {
        const normalizedName = address.name.toLowerCase()
        const normalizedAddress = address.address.toLowerCase()
        const normalizedLatitude = address.latitude.toLowerCase()
        const normalizedLongitude = address.long.toLowerCase()

        return (
          normalizedName.includes(normalizedSearch) ||
          normalizedAddress.includes(normalizedSearch) ||
          normalizedLatitude.includes(normalizedSearch) ||
          normalizedLongitude.includes(normalizedSearch)
        )
      })
  }, [addresses, searchValue])

  const shelterName = useMemo(() => resolveShelterName(session?.user), [session?.user])

  const selectedAdminContactLabel = useMemo(() => {
    const selectedValue = messageAdminUser.trim()
    if (!selectedValue) {
      return resolveAdminContactSummary(settingsRecord?.messageAdminUser)
    }

    return adminContactOptions.find((option) => option.value === selectedValue)?.label
      ?? resolveAdminContactSummary(settingsRecord?.messageAdminUser)
  }, [adminContactOptions, messageAdminUser, settingsRecord?.messageAdminUser])

  const loadAdminContactOptions = useCallback(async () => {
    if (!accessToken) {
      setAdminContactOptions([])
      setIsLoadingAdminContactOptions(false)
      return
    }

    setIsLoadingAdminContactOptions(true)

    try {
      const users = await userService.list(accessToken, {
        page: 0,
        size: 200,
        sortBy: 'lastName',
        sortDir: 'asc',
      })

      const nextAdminOptions = users
        .filter((user) => {
          const roleValue = resolveUserRoleValue(user.role)
          return roleValue === 'ADMIN' || roleValue === 'SYSTEM_ADMIN'
        })
        .map((user) => {
          const nextUserId = user.id?.trim() ?? ''
          if (!nextUserId) {
            return null
          }

          return {
            label: resolveAdminContactLabel(user),
            value: nextUserId,
          }
        })
        .filter((option): option is AdminContactOption => Boolean(option))

      setAdminContactOptions(nextAdminOptions)
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingAdminContactOptions(false)
    }
  }, [accessToken, showToast])

  const loadCompanySettings = useCallback(async () => {
    if (!accessToken) {
      setContactNumber(DEFAULT_CONTACT_NUMBER)
      setEmailAddress(DEFAULT_EMAIL_ADDRESS)
      setLinkUrl(DEFAULT_LINK_URL)
      setMessageAdminUser(DEFAULT_MESSAGE_ADMIN_USER)
      setTotalAvailableSpaceForPets(DEFAULT_TOTAL_AVAILABLE_SPACE_FOR_PETS)
      setMaxRescuesPerDay(DEFAULT_MAX_RESCUES_PER_DAY)
      setAddresses([createEmptyAddress()])
      setSettingsRecord(null)
      setIsEditMode(canManageCompanySettings)
      clearFormErrors()
      return
    }

    setIsLoadingSettings(true)

    try {
      const response = await companySettingsService.get(accessToken)
      const nextForm = mapSettingsToForm(response)
      setContactNumber(nextForm.contactNumber)
      setEmailAddress(nextForm.emailAddress)
      setLinkUrl(nextForm.linkUrl)
      setMessageAdminUser(nextForm.messageAdminUser)
      setTotalAvailableSpaceForPets(nextForm.totalAvailableSpaceForPets)
      setMaxRescuesPerDay(nextForm.maxRescuesPerDay)
      setAddresses(nextForm.addresses.length > 0 ? nextForm.addresses : [createEmptyAddress()])
      setSettingsRecord(response)
      setIsEditMode(false)
      clearFormErrors()
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setContactNumber(DEFAULT_CONTACT_NUMBER)
        setEmailAddress(DEFAULT_EMAIL_ADDRESS)
        setLinkUrl(DEFAULT_LINK_URL)
        setMessageAdminUser(DEFAULT_MESSAGE_ADMIN_USER)
        setTotalAvailableSpaceForPets(DEFAULT_TOTAL_AVAILABLE_SPACE_FOR_PETS)
        setMaxRescuesPerDay(DEFAULT_MAX_RESCUES_PER_DAY)
        setAddresses([createEmptyAddress()])
        setSettingsRecord(null)
        setIsEditMode(canManageCompanySettings)
        clearFormErrors()
        return
      }

      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingSettings(false)
    }
  }, [accessToken, canManageCompanySettings, clearFormErrors, showToast])

  useEffect(() => {
    clearToast()
    void loadCompanySettings()
  }, [clearToast, loadCompanySettings])

  useEffect(() => {
    const rawStoredValue = localStorageService.get(SUPPORT_CHAT_IMPORT_STORAGE_KEY)
    if (!rawStoredValue) {
      setLastSupportChatImport(null)
      return
    }

    try {
      const parsedValue = JSON.parse(rawStoredValue) as unknown
      const normalizedRecord = normalizeSupportChatImportRecord(parsedValue)

      if (!normalizedRecord) {
        localStorageService.remove(SUPPORT_CHAT_IMPORT_STORAGE_KEY)
        setLastSupportChatImport(null)
        return
      }

      setLastSupportChatImport(normalizedRecord)
    } catch {
      localStorageService.remove(SUPPORT_CHAT_IMPORT_STORAGE_KEY)
      setLastSupportChatImport(null)
    }
  }, [])

  useEffect(() => {
    void loadAdminContactOptions()
  }, [loadAdminContactOptions])

  useEffect(() => {
    if (adminContactOptions.length === 0) {
      return
    }

    const selectedValue = messageAdminUser.trim()
    const hasValidSelectedAdmin = adminContactOptions.some((option) => option.value === selectedValue)

    if (hasValidSelectedAdmin) {
      return
    }

    const backendContactId = settingsRecord?.messageAdminUser?.id?.trim() ?? ''
    const hasBackendContactOption = adminContactOptions.some((option) => option.value === backendContactId)

    if (hasBackendContactOption) {
      setMessageAdminUser(backendContactId)
      return
    }

    const defaultAdminOption = adminContactOptions[0]
    if (!defaultAdminOption) {
      return
    }

    setMessageAdminUser(defaultAdminOption.value)
  }, [adminContactOptions, messageAdminUser, settingsRecord?.messageAdminUser?.id])

  const handleAddressFieldChange = (
    index: number,
    field: keyof CompanyAddressForm,
    value: string,
  ) => {
    const normalizedValue = field === 'name' ? toTitleCase(value) : value

    setAddresses((currentAddresses) =>
      currentAddresses.map((address, currentIndex) =>
        currentIndex === index ? { ...address, [field]: normalizedValue } : address,
      ),
    )

    clearAddressItemErrors(index, [field])
    setFormErrors((currentErrors) => ({
      ...currentErrors,
      addresses: undefined,
    }))
  }

  const handleAddAddress = () => {
    setAddresses((currentAddresses) => [...currentAddresses, createEmptyAddress()])
    setFormErrors((currentErrors) => ({
      ...currentErrors,
      addresses: undefined,
      addressItems: [...currentErrors.addressItems, {}],
    }))
  }

  const handleRemoveAddress = (index: number) => {
    setAddresses((currentAddresses) => {
      if (currentAddresses.length <= 1) {
        return [createEmptyAddress()]
      }

      return currentAddresses.filter((_, currentIndex) => currentIndex !== index)
    })

    setFormErrors((currentErrors) => {
      if (currentErrors.addressItems.length <= 1) {
        return {
          ...currentErrors,
          addresses: undefined,
          addressItems: [{}],
        }
      }

      return {
        ...currentErrors,
        addresses: undefined,
        addressItems: currentErrors.addressItems.filter((_, currentIndex) => currentIndex !== index),
      }
    })
  }

  const clearSupportChatImportSelection = () => {
    setSupportChatImportFile(null)

    if (supportChatImportInputRef.current) {
      supportChatImportInputRef.current.value = ''
    }
  }

  const trySetSupportChatImportFile = (nextFile: File | null) => {
    if (!nextFile) {
      setSupportChatImportFile(null)
      return false
    }

    if (!hasAcceptedSupportChatImportExtension(nextFile.name)) {
      showToast('Only .json files are supported for support flow import.', { variant: 'error' })
      clearSupportChatImportSelection()
      return false
    }

    if (nextFile.size > MAX_SUPPORT_CHAT_IMPORT_FILE_SIZE_BYTES) {
      showToast('Selected file exceeds the 1 MB upload limit for support flow import.', { variant: 'error' })
      clearSupportChatImportSelection()
      return false
    }

    setSupportChatImportFile(nextFile)
    return true
  }

  const handleSupportChatImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null

    trySetSupportChatImportFile(nextFile)
  }

  const clearSupportChatImportDragState = () => {
    supportChatImportDragDepthRef.current = 0
    setIsSupportImportDragOver(false)
  }

  const handleSupportImportDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (isImportingSupportChats) {
      return
    }

    supportChatImportDragDepthRef.current += 1
    setIsSupportImportDragOver(true)
  }

  const handleSupportImportDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (isImportingSupportChats) {
      return
    }

    event.dataTransfer.dropEffect = 'copy'
    setIsSupportImportDragOver(true)
  }

  const handleSupportImportDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (isImportingSupportChats) {
      clearSupportChatImportDragState()
      return
    }

    supportChatImportDragDepthRef.current -= 1

    if (supportChatImportDragDepthRef.current <= 0) {
      clearSupportChatImportDragState()
    }
  }

  const handleSupportImportDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    clearSupportChatImportDragState()

    if (isImportingSupportChats) {
      return
    }

    const droppedFiles = Array.from(event.dataTransfer.files ?? [])
    const nextFile = droppedFiles[0] ?? null

    if (!nextFile) {
      showToast('No file detected. Drag and drop a support flow file to import.', { variant: 'error' })
      return
    }

    if (droppedFiles.length > 1) {
      showToast('Multiple files detected. Using the first dropped file.', { variant: 'info' })
    }

    trySetSupportChatImportFile(nextFile)
  }

  const handleSupportImportDropZoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()

    if (isImportingSupportChats) {
      return
    }

    supportChatImportInputRef.current?.click()
  }

  const handleConfirmSupportChatImport = () => {
    const selectedFile = supportChatImportFile

    if (!canImportSupportFlow) {
      showToast('Only system admins can import support flow.', { variant: 'error' })
      setIsSupportImportConfirmOpen(false)
      return
    }

    if (!accessToken) {
      showToast('You need to sign in before importing support flow.', { variant: 'error' })
      setIsSupportImportConfirmOpen(false)
      return
    }

    if (!userId) {
      showToast('Your session is missing user ID required by the API header.', { variant: 'error' })
      setIsSupportImportConfirmOpen(false)
      return
    }

    if (!selectedFile) {
      showToast('Select a support flow file before importing.', { variant: 'error' })
      setIsSupportImportConfirmOpen(false)
      return
    }

    const importSupportChatFile = async () => {
      setIsImportingSupportChats(true)

      try {
        const rawContent = await selectedFile.text()
        const normalizedContent = rawContent.trim()

        if (!normalizedContent) {
          throw new Error('Selected file is empty. Please choose a file with support flow content.')
        }

        const parsedPayload = JSON.parse(normalizedContent) as unknown
        if (!isSupportFlowImportRequest(parsedPayload)) {
          throw new Error('Support flow import file must contain a valid JSON object.')
        }

        await companySettingsService.importSupportFlow(parsedPayload, accessToken, userId)

        const nextImportRecord: SupportChatImportRecord = {
          fileName: selectedFile.name.trim(),
          importedAt: new Date().toISOString(),
          size: selectedFile.size,
        }

        localStorageService.set(SUPPORT_CHAT_IMPORT_STORAGE_KEY, JSON.stringify(nextImportRecord))
        setLastSupportChatImport(nextImportRecord)
        clearSupportChatImportSelection()
        setIsSupportImportConfirmOpen(false)
        showToast('Support flow imported successfully.', { variant: 'success' })
      } catch (error) {
        showToast(getErrorMessage(error, 'Unable to import support flow.'), { variant: 'error' })
      } finally {
        setIsImportingSupportChats(false)
      }
    }

    void importSupportChatFile()
  }

  const buildPayload = (): CompanySettingsPayload | null => {
    const trimmedContactNumber = contactNumber.trim()
    const normalizedContactNumber = normalizeContactNumber(trimmedContactNumber)
    const trimmedEmailAddress = emailAddress.trim()
    const trimmedLinkUrl = linkUrl.trim()
    const trimmedMessageAdminUserId = messageAdminUser.trim()
    const trimmedTotalAvailableSpaceForPets = totalAvailableSpaceForPets.trim()
    const trimmedMaxRescuesPerDay = maxRescuesPerDay.trim()
    const nextFormErrors: CompanySettingsFormErrors = {
      addressItems: Array.from({ length: addresses.length }, () => ({})),
    }

    if (!trimmedContactNumber) {
      nextFormErrors.contactNumber = 'Contact number is required.'
    } else if (!isValidContactNumber(trimmedContactNumber)) {
      nextFormErrors.contactNumber = 'Contact number must be 7-15 digits and may start with +.'
    }

    if (!trimmedEmailAddress) {
      nextFormErrors.emailAddress = 'Email address is required.'
    } else if (!isValidEmail(trimmedEmailAddress)) {
      nextFormErrors.emailAddress = 'Email address must be a valid email.'
    }

    if (trimmedLinkUrl && !HTTP_URL_PATTERN.test(trimmedLinkUrl)) {
      nextFormErrors.linkUrl = 'Link URL must start with http:// or https://.'
    }

    if (!trimmedTotalAvailableSpaceForPets) {
      nextFormErrors.totalAvailableSpaceForPets = 'Total available space for pets is required.'
    } else {
      const parsedTotalAvailableSpaceForPets = parseWholeNumber(trimmedTotalAvailableSpaceForPets)
      if (!Number.isInteger(parsedTotalAvailableSpaceForPets) || parsedTotalAvailableSpaceForPets < 0) {
        nextFormErrors.totalAvailableSpaceForPets = 'Total available space for pets must be 0 or greater.'
      }
    }

    if (!trimmedMaxRescuesPerDay) {
      nextFormErrors.maxRescuesPerDay = 'Maximum rescues per day is required.'
    } else {
      const parsedMaxRescuesPerDay = parseWholeNumber(trimmedMaxRescuesPerDay)
      if (!Number.isInteger(parsedMaxRescuesPerDay) || parsedMaxRescuesPerDay < 1) {
        nextFormErrors.maxRescuesPerDay = 'Maximum rescues per day must be at least 1.'
      }
    }

    if (addresses.length === 0) {
      nextFormErrors.addresses = 'At least one address is required.'
    }

    const normalizedAddresses: CompanySettingsPayload['addresses'] = []

    for (let index = 0; index < addresses.length; index += 1) {
      const address = addresses[index]
      const trimmedName = toTitleCase(address.name).trim()
      const trimmedAddress = address.address.trim()
      const trimmedLongitude = address.long.trim()
      const trimmedLatitude = address.latitude.trim()
      const longitude = parseCoordinate(address.long)
      const latitude = parseCoordinate(address.latitude)
      const itemErrors = nextFormErrors.addressItems[index]

      if (!trimmedName) {
        itemErrors.name = 'Name is required.'
      }

      if (!trimmedAddress) {
        itemErrors.address = 'Address is required.'
      }

      if (!trimmedLongitude) {
        itemErrors.long = 'Longitude is required.'
      } else if (!Number.isFinite(longitude) || !isValidLongitude(longitude)) {
        itemErrors.long = 'Longitude must be between -180 and 180.'
      }

      if (!trimmedLatitude) {
        itemErrors.latitude = 'Latitude is required.'
      } else if (!Number.isFinite(latitude) || !isValidLatitude(latitude)) {
        itemErrors.latitude = 'Latitude must be between -90 and 90.'
      }

      if (itemErrors.name || itemErrors.address || itemErrors.long || itemErrors.latitude) {
        continue
      }

      normalizedAddresses.push({
        address: trimmedAddress,
        latitude,
        long: longitude,
        name: trimmedName,
      })
    }

    const hasErrors =
      Boolean(
        nextFormErrors.contactNumber ||
          nextFormErrors.emailAddress ||
          nextFormErrors.linkUrl ||
          nextFormErrors.totalAvailableSpaceForPets ||
          nextFormErrors.maxRescuesPerDay ||
          nextFormErrors.addresses,
      ) ||
      nextFormErrors.addressItems.some((itemErrors) =>
        Boolean(itemErrors.name || itemErrors.address || itemErrors.long || itemErrors.latitude),
      )

    if (hasErrors) {
      setFormErrors(nextFormErrors)
      return null
    }

    const parsedTotalAvailableSpaceForPets = parseWholeNumber(trimmedTotalAvailableSpaceForPets)
    const parsedMaxRescuesPerDay = parseWholeNumber(trimmedMaxRescuesPerDay)

    clearFormErrors()

    return {
      addresses: normalizedAddresses,
      contactNumber: normalizedContactNumber,
      emailAddress: trimmedEmailAddress,
      linkUrl: trimmedLinkUrl || undefined,
      maxRescuesPerDay: parsedMaxRescuesPerDay,
      messageAdminUserId: trimmedMessageAdminUserId || undefined,
      totalAvailableSpaceForPets: parsedTotalAvailableSpaceForPets,
    }
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before updating shelter settings.', { variant: 'error' })
      return
    }

    if (!canManageCompanySettings) {
      showToast('Only admins and system admins can update shelter settings.', { variant: 'error' })
      return
    }

    if (!userId) {
      showToast('Your session is missing user ID required by the API header.', { variant: 'error' })
      return
    }

    const payload = buildPayload()
    if (!payload) {
      return
    }

    const saveSettings = async () => {
      setIsSavingSettings(true)

      try {
        const response = await companySettingsService.upsert(payload, accessToken, userId)
        const nextForm = mapSettingsToForm(response)
        setContactNumber(nextForm.contactNumber)
        setEmailAddress(nextForm.emailAddress)
        setLinkUrl(nextForm.linkUrl)
        setMessageAdminUser(nextForm.messageAdminUser)
        setTotalAvailableSpaceForPets(nextForm.totalAvailableSpaceForPets)
        setMaxRescuesPerDay(nextForm.maxRescuesPerDay)
        setAddresses(nextForm.addresses.length > 0 ? nextForm.addresses : [createEmptyAddress()])
        setSettingsRecord(response)
        setIsEditMode(false)
        clearFormErrors()
        showToast(
          settingsRecord ? 'Shelter settings updated successfully.' : 'Shelter settings created successfully.',
          { variant: 'success' },
        )
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingSettings(false)
      }
    }

    void saveSettings()
  }

  return (
    <MainLayout
      isSidebarOpen={isSidebarOpen}
      onSidebarClose={() => {
        setIsSidebarOpen(false)
      }}
      header={
        <Header
          profile={resolvedHeaderProfile}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          isMenuOpen={isSidebarOpen}
          onMenuToggle={() => {
            setIsSidebarOpen((previousState) => !previousState)
          }}
        />
      }
      sidebar={
        <Sidebar
          session={session}
          activeItem={ACTIVE_MENU_ITEM}
          logoSrc={sidebarLogo}
          menuItems={sidebarMenuItems}
          bottomItems={sidebarBottomItems}
          onLogout={onLogout}
        />
      }
    >
      <Toast toast={toast} onClose={clearToast} />

      <div className={styles.page}>
        <section className={styles.container}>
          <header className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Shelter Settings</h1>
            {/* <p className={styles.pageSubtitle}>
              Configure contact details, rescue capacity, and mapped shelter addresses for all users.
            </p> */}
          </header>

          {canManageCompanySettings ? (
            <form className={styles.formPanel} onSubmit={handleSave} noValidate>
            <label className={styles.fieldLabel}>
              <span>Shelter Name</span>
              <span className={styles.detailValue}>{shelterName || 'N/A'}</span>
            </label>

            <label className={styles.fieldLabel}>
              <span>
                Contact Number <span className={styles.requiredMark}>*</span>
              </span>
              {isEditMode ? (
                <>
                  <input
                    type="tel"
                    inputMode="tel"
                    pattern="^\\+?[0-9]{7,15}$"
                    className={`${styles.fieldInput} ${formErrors.contactNumber ? styles.fieldInputError : ''}`}
                    value={contactNumber}
                    onChange={(event) => {
                      setContactNumber(event.target.value)
                      setFormErrors((currentErrors) => ({
                        ...currentErrors,
                        contactNumber: undefined,
                      }))
                    }}
                    placeholder="+63 912 345 6789"
                    disabled={isSavingSettings || isLoadingSettings}
                    aria-invalid={Boolean(formErrors.contactNumber)}
                  />
                  {formErrors.contactNumber ? <p className={styles.fieldError}>{formErrors.contactNumber}</p> : null}
                </>
              ) : (
                <span className={styles.detailValue}>{contactNumber.trim() || 'N/A'}</span>
              )}
            </label>

            <label className={styles.fieldLabel}>
              <span>
                Email Address <span className={styles.requiredMark}>*</span>
              </span>
              {isEditMode ? (
                <>
                  <input
                    type="email"
                    className={`${styles.fieldInput} ${formErrors.emailAddress ? styles.fieldInputError : ''}`}
                    value={emailAddress}
                    onChange={(event) => {
                      setEmailAddress(event.target.value)
                      setFormErrors((currentErrors) => ({
                        ...currentErrors,
                        emailAddress: undefined,
                      }))
                    }}
                    placeholder="hello@pawtnercare.com"
                    disabled={isSavingSettings || isLoadingSettings}
                    aria-invalid={Boolean(formErrors.emailAddress)}
                  />
                  {formErrors.emailAddress ? <p className={styles.fieldError}>{formErrors.emailAddress}</p> : null}
                </>
              ) : (
                <span className={styles.detailValue}>{emailAddress.trim() || 'N/A'}</span>
              )}
            </label>

            <label className={styles.fieldLabel}>
              <span>
                Link URL
              </span>
              {isEditMode ? (
                <>
                  <input
                    type="url"
                    className={`${styles.fieldInput} ${formErrors.linkUrl ? styles.fieldInputError : ''}`}
                    value={linkUrl}
                    onChange={(event) => {
                      setLinkUrl(event.target.value)
                      setFormErrors((currentErrors) => ({
                        ...currentErrors,
                        linkUrl: undefined,
                      }))
                    }}
                    placeholder="https://pawtnercare.com"
                    disabled={isSavingSettings || isLoadingSettings}
                    aria-invalid={Boolean(formErrors.linkUrl)}
                  />
                  {formErrors.linkUrl ? <p className={styles.fieldError}>{formErrors.linkUrl}</p> : null}
                </>
              ) : (
                linkUrl.trim() ? (
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`${styles.detailValue} ${styles.detailLink}`}
                  >
                    {linkUrl.trim()}
                  </a>
                ) : (
                  <span className={styles.detailValue}>N/A</span>
                )
              )}
            </label>

            <label className={styles.fieldLabel}>
              <span>Default Admin Contact</span>
              {isEditMode ? (
                <select
                  className={styles.fieldInput}
                  value={messageAdminUser}
                  onChange={(event) => {
                    setMessageAdminUser(event.target.value)
                  }}
                  disabled={
                    isSavingSettings ||
                    isLoadingSettings ||
                    isLoadingAdminContactOptions ||
                    adminContactOptions.length === 0
                  }
                >
                  {isLoadingAdminContactOptions ? <option value="">Loading admin users...</option> : null}
                  {!isLoadingAdminContactOptions && adminContactOptions.length === 0 ? (
                    <option value="">No admin users available</option>
                  ) : null}
                  {adminContactOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={styles.detailValue}>{selectedAdminContactLabel}</span>
              )}
            </label>

            <div className={styles.coordinateGrid}>
              <label className={styles.fieldLabel}>
                <span>
                  Total Available Space For Pets <span className={styles.requiredMark}>*</span>
                </span>
                {isEditMode ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className={`${styles.fieldInput} ${formErrors.totalAvailableSpaceForPets ? styles.fieldInputError : ''}`}
                      value={totalAvailableSpaceForPets}
                      onChange={(event) => {
                        setTotalAvailableSpaceForPets(event.target.value)
                        setFormErrors((currentErrors) => ({
                          ...currentErrors,
                          totalAvailableSpaceForPets: undefined,
                        }))
                      }}
                      placeholder="120"
                      disabled={isSavingSettings || isLoadingSettings}
                      aria-invalid={Boolean(formErrors.totalAvailableSpaceForPets)}
                    />
                    {formErrors.totalAvailableSpaceForPets ? (
                      <p className={styles.fieldError}>{formErrors.totalAvailableSpaceForPets}</p>
                    ) : null}
                  </>
                ) : (
                  <span className={styles.detailValue}>{totalAvailableSpaceForPets.trim() || 'N/A'}</span>
                )}
              </label>

              <label className={styles.fieldLabel}>
                <span>
                  Max Rescues Per Day <span className={styles.requiredMark}>*</span>
                </span>
                {isEditMode ? (
                  <>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className={`${styles.fieldInput} ${formErrors.maxRescuesPerDay ? styles.fieldInputError : ''}`}
                      value={maxRescuesPerDay}
                      onChange={(event) => {
                        setMaxRescuesPerDay(event.target.value)
                        setFormErrors((currentErrors) => ({
                          ...currentErrors,
                          maxRescuesPerDay: undefined,
                        }))
                      }}
                      placeholder="3"
                      disabled={isSavingSettings || isLoadingSettings}
                      aria-invalid={Boolean(formErrors.maxRescuesPerDay)}
                    />
                    {formErrors.maxRescuesPerDay ? (
                      <p className={styles.fieldError}>{formErrors.maxRescuesPerDay}</p>
                    ) : null}
                  </>
                ) : (
                  <span className={styles.detailValue}>{maxRescuesPerDay.trim() || 'N/A'}</span>
                )}
              </label>
            </div>

            <div className={styles.addressHeader}>
              <h2 className={styles.sectionTitle}>
                Shelter Addresses <span className={styles.requiredMark}>*</span>
              </h2>
              {isEditMode ? (
                <button
                  type="button"
                  className={styles.addAddressButton}
                  onClick={handleAddAddress}
                  disabled={isSavingSettings || isLoadingSettings}
                >
                  <FaPlus aria-hidden="true" />
                  Add Address
                </button>
              ) : null}
            </div>
            {isEditMode && formErrors.addresses ? <p className={styles.fieldError}>{formErrors.addresses}</p> : null}

            {filteredAddresses.length === 0 ? (
              <div className={styles.emptyState}>No matching addresses for your search.</div>
            ) : (
              <div className={styles.addressGrid}>
                {filteredAddresses.map(({ address, index }) => {
                  const key = `address-${index}`
                  const addressErrors = formErrors.addressItems[index]

                  return (
                    <article key={key} className={styles.addressCard}>
                      <div className={styles.addressCardHeader}>
                        <h3 className={styles.addressCardTitle}>Address #{index + 1}</h3>
                        {isEditMode ? (
                          <button
                            type="button"
                            className={styles.removeAddressButton}
                            onClick={() => {
                              handleRemoveAddress(index)
                            }}
                            disabled={isSavingSettings || isLoadingSettings}
                            aria-label={`Remove address ${index + 1}`}
                          >
                            <FaTrashAlt aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>

                      <label className={styles.fieldLabel}>
                        <span>
                          Name <span className={styles.requiredMark}>*</span>
                        </span>
                        {isEditMode ? (
                          <>
                            <input
                              type="text"
                              className={`${styles.fieldInput} ${addressErrors?.name ? styles.fieldInputError : ''}`}
                              value={address.name}
                              onChange={(event) => {
                                handleAddressFieldChange(index, 'name', event.target.value)
                              }}
                              placeholder="Main Office"
                              disabled={isSavingSettings || isLoadingSettings}
                              aria-invalid={Boolean(addressErrors?.name)}
                            />
                            {addressErrors?.name ? <p className={styles.fieldError}>{addressErrors.name}</p> : null}
                          </>
                        ) : (
                          <span className={styles.detailValue}>{address.name.trim() || 'N/A'}</span>
                        )}
                      </label>

                      <label className={styles.fieldLabel}>
                        <span>
                          Address <span className={styles.requiredMark}>*</span>
                        </span>
                        {isEditMode ? (
                          <>
                            <LocationPickerMap
                              showCoordinateInputs={false}
                              value={{
                                address: address.address,
                                latitude: address.latitude,
                                longitude: address.long,
                              }}
                              onChange={(nextLocation) => {
                                setAddresses((currentAddresses) =>
                                  currentAddresses.map((currentAddress, currentIndex) =>
                                    currentIndex === index
                                      ? {
                                          ...currentAddress,
                                          address: nextLocation.address,
                                          latitude: nextLocation.latitude,
                                          long: nextLocation.longitude,
                                        }
                                      : currentAddress,
                                  ),
                                )

                                clearAddressItemErrors(index, ['address', 'long', 'latitude'])
                                setFormErrors((currentErrors) => ({
                                  ...currentErrors,
                                  addresses: undefined,
                                }))
                              }}
                            />
                            {addressErrors?.address ? <p className={styles.fieldError}>{addressErrors.address}</p> : null}
                            {addressErrors?.long ? <p className={styles.fieldError}>{addressErrors.long}</p> : null}
                            {addressErrors?.latitude ? <p className={styles.fieldError}>{addressErrors.latitude}</p> : null}
                          </>
                        ) : (
                          <span className={styles.detailValue}>{address.address.trim() || 'N/A'}</span>
                        )}
                      </label>

                    </article>
                  )
                })}
              </div>
            )}

              <div className={styles.footerActions}>
                {isEditMode ? (
                  <>
                    <button
                      type="button"
                      className={styles.resetButton}
                      onClick={() => {
                        if (settingsRecord) {
                          const nextForm = mapSettingsToForm(settingsRecord)
                          setContactNumber(nextForm.contactNumber)
                          setEmailAddress(nextForm.emailAddress)
                          setLinkUrl(nextForm.linkUrl)
                          setMessageAdminUser(nextForm.messageAdminUser)
                          setTotalAvailableSpaceForPets(nextForm.totalAvailableSpaceForPets)
                          setMaxRescuesPerDay(nextForm.maxRescuesPerDay)
                          setAddresses(nextForm.addresses.length > 0 ? nextForm.addresses : [createEmptyAddress()])
                          setIsEditMode(false)
                          clearFormErrors()
                        } else {
                          void loadCompanySettings()
                        }
                      }}
                      disabled={isSavingSettings || isLoadingSettings}
                    >
                      <FaTimes aria-hidden="true" />
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.saveButton}
                      disabled={isSavingSettings || isLoadingSettings}
                    >
                      <FaSave aria-hidden="true" />
                      {isSavingSettings ? 'Saving...' : 'Save Shelter Settings'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.saveButton}
                    onClick={() => {
                      clearFormErrors()
                      setIsEditMode(true)
                    }}
                    disabled={isLoadingSettings}
                  >
                    <FaEdit aria-hidden="true" />
                    Edit
                  </button>
                )}
              </div>
            </form>
          ) : null}

          {canImportSupportFlow ? (
            <section className={styles.importPanel} aria-labelledby="support-chat-import-title">
            <header className={styles.importPanelHeader}>
              <h2 id="support-chat-import-title" className={styles.importPanelTitle}>Support Flow Import</h2>
              <p className={styles.importPanelDescription}>
                Upload or drag and drop a support flow JSON file, then confirm import.
              </p>
            </header>

            <input
              ref={supportChatImportInputRef}
              id="support-chat-import-file"
              type="file"
              accept=".json,application/json"
              className={styles.importFileInput}
              onChange={handleSupportChatImportFileChange}
              disabled={isImportingSupportChats}
            />

            <div
              role="button"
              tabIndex={isImportingSupportChats ? -1 : 0}
              aria-disabled={isImportingSupportChats}
              className={`${styles.importDropZone} ${
                isSupportImportDragOver ? styles.importDropZoneActive : ''
              } ${isImportingSupportChats ? styles.importDropZoneDisabled : ''}`}
              onClick={() => {
                if (isImportingSupportChats) {
                  return
                }

                supportChatImportInputRef.current?.click()
              }}
              onKeyDown={handleSupportImportDropZoneKeyDown}
              onDragEnter={handleSupportImportDragEnter}
              onDragOver={handleSupportImportDragOver}
              onDragLeave={handleSupportImportDragLeave}
              onDrop={handleSupportImportDrop}
            >
              <p className={styles.importDropZoneTitle}>Drag and drop your support flow JSON file here</p>
              <p className={styles.importDropZoneHint}>or click this area to browse files</p>
            </div>

            <div className={styles.importActionRow}>
              <button
                type="button"
                className={styles.uploadImportButton}
                onClick={() => {
                  if (!supportChatImportFile) {
                    showToast('Select a support flow file before importing.', { variant: 'error' })
                    return
                  }

                  setIsSupportImportConfirmOpen(true)
                }}
                disabled={!supportChatImportFile || isImportingSupportChats}
              >
                <FaUpload aria-hidden="true" />
                {isImportingSupportChats ? 'Importing...' : 'Upload & Import'}
              </button>

              {supportChatImportFile ? (
                <button
                  type="button"
                  className={styles.removeImportButton}
                  onClick={() => {
                    clearSupportChatImportSelection()
                  }}
                  disabled={isImportingSupportChats}
                >
                  Remove Selected File
                </button>
              ) : null}
            </div>

            {supportChatImportFile ? (
              <div className={styles.importMetaCard}>
                <p className={styles.importMetaText}>
                  <strong>Selected file:</strong> {supportChatImportFile.name}
                </p>
                <p className={styles.importMetaText}>
                  <strong>Size:</strong> {formatFileSize(supportChatImportFile.size)}
                </p>
                <p className={styles.importMetaText}>
                  <strong>Last modified:</strong> {new Date(supportChatImportFile.lastModified).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className={styles.importHint}>
                Accepted file type: {SUPPORT_CHAT_IMPORT_ACCEPTED_EXTENSIONS.join(', ')} (max 1 MB).
              </p>
            )}

            {lastSupportChatImport ? (
              <div className={styles.importMetaCard}>
                <p className={styles.importMetaText}>
                  <strong>Last imported:</strong> {lastSupportChatImport.fileName}
                </p>
                <p className={styles.importMetaText}>
                  <strong>Imported at:</strong> {formatImportedAt(lastSupportChatImport.importedAt)}
                </p>
                <p className={styles.importMetaText}>
                  <strong>Stored size:</strong> {formatFileSize(lastSupportChatImport.size)}
                </p>
              </div>
            ) : null}
            </section>
          ) : null}
        </section>
      </div>

      <ConfirmModal
        ariaLabel="Support flow import confirmation dialog"
        cancelLabel="Cancel"
        confirmLabel={isImportingSupportChats ? 'Uploading...' : 'Upload & Import'}
        confirmTone="success"
        isBusy={isImportingSupportChats}
        isOpen={isSupportImportConfirmOpen}
        message={
          supportChatImportFile
            ? `Upload and import "${supportChatImportFile.name}" to support flow?`
            : 'Upload and import this file to support flow?'
        }
        onCancel={() => {
          if (!isImportingSupportChats) {
            setIsSupportImportConfirmOpen(false)
          }
        }}
        onConfirm={handleConfirmSupportChatImport}
        title="Confirm Support Flow Import"
      />
    </MainLayout>
  )
}

export default CompanySettingsPage



