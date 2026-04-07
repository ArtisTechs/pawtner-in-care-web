import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaEdit, FaPlus, FaRegStar, FaStar, FaStarHalfAlt, FaTimes, FaTrashAlt } from 'react-icons/fa'
import veterinaryPlaceholderImage from '@/assets/veterinary-default-icon.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import {
  type AddVeterinaryClinicForm,
  DEFAULT_ADD_VETERINARY_CLINIC_FORM,
  LIST_BATCH_SIZE,
  LIST_INITIAL_BATCH_SIZE,
  LIST_SKELETON_ROW_COUNT,
} from '@/features/veterinary-clinics/constants/veterinary-clinic-list.constants'
import { veterinaryClinicService } from '@/features/veterinary-clinics/services/veterinary-clinic.service'
import type { VeterinaryClinic } from '@/features/veterinary-clinics/types/veterinary-clinic-api'
import {
  buildVeterinaryClinicPayload,
  mapVeterinaryClinicToForm,
} from '@/features/veterinary-clinics/utils/veterinary-clinic-form'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import LocationPickerMap from '@/shared/components/maps/LocationPickerMap/LocationPickerMap'
import PhotoUploadField from '@/shared/components/media/PhotoUploadField/PhotoUploadField'
import VideoUploadField from '@/shared/components/media/VideoUploadField/VideoUploadField'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import TimePicker from '@/shared/components/ui/TimePicker/TimePicker'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import { isValidContactNumber, normalizeContactNumber } from '@/shared/lib/validation/contact'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './VeterinaryClinicListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'veterinary-clinic-list'

const resolveClinicImage = (clinic: VeterinaryClinic) => {
  const logo = clinic.logo?.trim()
  if (logo) {
    return logo
  }

  const firstPhoto = clinic.photos?.find((photo) => photo.trim())
  return firstPhoto ?? veterinaryPlaceholderImage
}

const formatOpeningTime = (value?: string | null) => {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return 'N/A'
  }

  const match = trimmed.match(/\b(\d{2}):(\d{2})\b/)
  return match ? `${match[1]}:${match[2]}` : trimmed
}

const formatOpeningTimeWithMeridiem = (value?: string | null) => {
  const normalizedTime = formatOpeningTime(value)
  if (normalizedTime === 'N/A') {
    return normalizedTime
  }

  const match = normalizedTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) {
    return normalizedTime
  }

  const hour24 = Number.parseInt(match[1], 10)
  const minute = match[2]
  const meridiem = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12

  return `${hour12}:${minute} ${meridiem}`
}

const formatOpenDay = (value: string) => {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return ''
  }

  return trimmedValue.charAt(0).toUpperCase() + trimmedValue.slice(1).toLowerCase()
}

const OPEN_DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

type OpenDayKey = (typeof OPEN_DAY_ORDER)[number]

const OPEN_DAY_SHORT_LABELS: Record<OpenDayKey, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

const OPEN_DAY_FULL_LABELS: Record<OpenDayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const isOpenDayKey = (value: string): value is OpenDayKey =>
  OPEN_DAY_ORDER.includes(value as OpenDayKey)

const normalizeOpenDaysForDisplay = (values?: string[] | null) => {
  const uniqueDays = (values ?? [])
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)

  const orderedKnownDays = OPEN_DAY_ORDER.filter((day) => uniqueDays.includes(day))
  const unknownDays = uniqueDays.filter((day) => !isOpenDayKey(day))

  return [...orderedKnownDays, ...unknownDays]
}

const getOpenDayLabels = (values?: string[] | null, variant: 'short' | 'full' = 'full') =>
  normalizeOpenDaysForDisplay(values).map((day) => {
    if (isOpenDayKey(day)) {
      return variant === 'short' ? OPEN_DAY_SHORT_LABELS[day] : OPEN_DAY_FULL_LABELS[day]
    }

    return formatOpenDay(day)
  })

const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return 'N/A'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A'
  }

  return parsedDate.toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const MAP_PREVIEW_DELTA = 0.008

const buildReadOnlyMapPreviewUrl = (latitude?: number | null, longitude?: number | null) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return ''
  }

  const minLongitude = longitude - MAP_PREVIEW_DELTA
  const maxLongitude = longitude + MAP_PREVIEW_DELTA
  const minLatitude = latitude - MAP_PREVIEW_DELTA
  const maxLatitude = latitude + MAP_PREVIEW_DELTA

  const searchParams = new URLSearchParams({
    bbox: `${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}`,
    layer: 'mapnik',
    marker: `${latitude},${longitude}`,
  })

  return `https://www.openstreetmap.org/export/embed.html?${searchParams.toString()}`
}

const formatListCell = (values?: string[] | null) => {
  const normalized = values?.map((item) => item.trim()).filter(Boolean) ?? []

  if (normalized.length === 0) {
    return 'N/A'
  }

  if (normalized.length <= 2) {
    return normalized.join(', ')
  }

  return `${normalized.slice(0, 2).join(', ')} +${normalized.length - 2} more`
}

const formatListDetails = (values?: string[] | null) => {
  const normalized = values?.map((item) => item.trim()).filter(Boolean) ?? []
  return normalized.length === 0 ? 'N/A' : normalized.join('\n')
}

const resolvePrimaryVideo = (clinic?: VeterinaryClinic | null) => {
  if (!clinic?.videos?.length) {
    return ''
  }

  return clinic.videos.find((video) => video.trim()) ?? ''
}

const resolveRatingSliderValue = (value: string) => {
  const parsedValue = Number.parseFloat(value)
  if (!Number.isFinite(parsedValue)) {
    return 0
  }

  return Math.min(5, Math.max(0, parsedValue))
}

const OPEN_DAY_OPTIONS = [
  { label: 'Mon', value: 'monday' },
  { label: 'Tue', value: 'tuesday' },
  { label: 'Wed', value: 'wednesday' },
  { label: 'Thu', value: 'thursday' },
  { label: 'Fri', value: 'friday' },
  { label: 'Sat', value: 'saturday' },
  { label: 'Sun', value: 'sunday' },
] as const

const parseOpenDayValues = (value: string) =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item, index, values) => values.indexOf(item) === index)

const serializeOpenDayValues = (values: string[]) => {
  const orderedValues = OPEN_DAY_OPTIONS.map((option) => option.value).filter((value) =>
    values.includes(value),
  )

  return orderedValues.join(', ')
}

const autoCapitalizeName = (value: string) =>
  value
    .split(' ')
    .map((part) => {
      if (!part) {
        return part
      }

      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')

interface VeterinaryClinicListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function VeterinaryClinicListPage({ onLogout, session }: VeterinaryClinicListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const [clinics, setClinics] = useState<VeterinaryClinic[]>([])
  const [isLoadingClinics, setIsLoadingClinics] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingClinic, setViewingClinic] = useState<VeterinaryClinic | null>(null)
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null)
  const [isSavingClinic, setIsSavingClinic] = useState(false)
  const [clinicIdBeingDeleted, setClinicIdBeingDeleted] = useState<string | null>(null)
  const [pendingDeleteClinic, setPendingDeleteClinic] = useState<{ id: string; name: string } | null>(null)
  const [addClinicForm, setAddClinicForm] = useState<AddVeterinaryClinicForm>(
    DEFAULT_ADD_VETERINARY_CLINIC_FORM,
  )
  const [contactNumberError, setContactNumberError] = useState('')
  const [openingTimeError, setOpeningTimeError] = useState('')
  const [closingTimeError, setClosingTimeError] = useState('')
  const [openDaysError, setOpenDaysError] = useState('')
  const [visibleClinicCount, setVisibleClinicCount] = useState(LIST_INITIAL_BATCH_SIZE)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)
  const accessToken = session?.accessToken?.trim() ?? ''
  const ratingSliderValue = useMemo(
    () => resolveRatingSliderValue(addClinicForm.ratings),
    [addClinicForm.ratings],
  )
  const selectedOpenDays = useMemo(
    () => parseOpenDayValues(addClinicForm.openDays),
    [addClinicForm.openDays],
  )

  const loadClinics = useCallback(async () => {
    if (!accessToken) {
      setClinics([])
      return
    }

    setIsLoadingClinics(true)

    try {
      const clinicList = await veterinaryClinicService.list(accessToken)
      setClinics(Array.isArray(clinicList) ? clinicList : [])
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingClinics(false)
    }
  }, [accessToken, showToast])

  useEffect(() => {
    clearToast()
    void loadClinics()
  }, [clearToast, loadClinics])

  const filteredClinics = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    if (!normalizedSearch) {
      return clinics
    }

    return clinics.filter((clinic) => {
      const normalizedName = clinic.name?.toLowerCase() ?? ''
      const normalizedDescription = clinic.description?.toLowerCase() ?? ''
      const normalizedAddress = clinic.locationAddress?.toLowerCase() ?? ''
      const normalizedRatings = clinic.ratings?.toLowerCase() ?? ''
      const normalizedOpeningTime = clinic.openingTime?.toLowerCase() ?? ''
      const normalizedClosingTime = clinic.closingTime?.toLowerCase() ?? ''
      const normalizedOpenDays = clinic.openDays?.join(' ').toLowerCase() ?? ''
      const normalizedContacts = clinic.contactNumbers?.join(' ').toLowerCase() ?? ''

      return (
        normalizedName.includes(normalizedSearch) ||
        normalizedDescription.includes(normalizedSearch) ||
        normalizedAddress.includes(normalizedSearch) ||
        normalizedRatings.includes(normalizedSearch) ||
        normalizedOpeningTime.includes(normalizedSearch) ||
        normalizedClosingTime.includes(normalizedSearch) ||
        normalizedOpenDays.includes(normalizedSearch) ||
        normalizedContacts.includes(normalizedSearch)
      )
    })
  }, [clinics, searchValue])

  useEffect(() => {
    setVisibleClinicCount(LIST_INITIAL_BATCH_SIZE)
  }, [filteredClinics])

  const visibleClinics = useMemo(
    () => filteredClinics.slice(0, visibleClinicCount),
    [filteredClinics, visibleClinicCount],
  )
  const hasMoreClinicsToReveal = visibleClinics.length < filteredClinics.length
  const skeletonRowIndexes = useMemo(
    () => Array.from({ length: LIST_SKELETON_ROW_COUNT }, (_, index) => index),
    [],
  )

  useEffect(() => {
    const scrollContainer = tableScrollRef.current
    const triggerElement = loadMoreTriggerRef.current
    if (!scrollContainer || !triggerElement || isLoadingClinics || !hasMoreClinicsToReveal) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) {
          return
        }

        setVisibleClinicCount((currentCount) =>
          Math.min(currentCount + LIST_BATCH_SIZE, filteredClinics.length),
        )
      },
      {
        root: scrollContainer,
        rootMargin: '120px 0px',
        threshold: 0.05,
      },
    )

    observer.observe(triggerElement)

    return () => {
      observer.disconnect()
    }
  }, [filteredClinics.length, hasMoreClinicsToReveal, isLoadingClinics])

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false)
    setEditingClinicId(null)
    setAddClinicForm(DEFAULT_ADD_VETERINARY_CLINIC_FORM)
    setContactNumberError('')
    setOpeningTimeError('')
    setClosingTimeError('')
    setOpenDaysError('')
  }, [])

  const closeViewModal = useCallback(() => {
    setViewingClinic(null)
  }, [])

  const handleAddClinicSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing veterinary clinics.', { variant: 'error' })
      return
    }

    const persistClinic = async () => {
      const trimmedName = addClinicForm.name.trim()
      const trimmedLocationAddress = addClinicForm.locationAddress.trim()
      const trimmedOpeningTime = addClinicForm.openingTime.trim()
      const trimmedClosingTime = addClinicForm.closingTime.trim()
      const normalizedOpenDays = parseOpenDayValues(addClinicForm.openDays)

      setContactNumberError('')
      setOpeningTimeError('')
      setClosingTimeError('')
      setOpenDaysError('')

      if (!trimmedName || !trimmedLocationAddress) {
        showToast('Please complete all required fields.', { variant: 'error' })
        return
      }

      const normalizedContactNumbers = addClinicForm.contactNumbers
        .map((contactNumber) => normalizeContactNumber(contactNumber))
        .filter(Boolean)

      if (normalizedContactNumbers.length === 0) {
        const errorMessage = 'At least one contact number is required.'
        setContactNumberError(errorMessage)
        showToast(errorMessage, { variant: 'error' })
        return
      }

      const hasInvalidContactNumber = normalizedContactNumbers.some(
        (contactNumber) => !isValidContactNumber(contactNumber),
      )

      if (hasInvalidContactNumber) {
        const errorMessage = 'Contact numbers must be 7-15 digits and may start with +.'
        setContactNumberError(errorMessage)
        showToast(errorMessage, { variant: 'error' })
        return
      }

      if (!trimmedOpeningTime) {
        const errorMessage = 'Opening time is required.'
        setOpeningTimeError(errorMessage)
        showToast(errorMessage, { variant: 'error' })
        return
      }

      if (!trimmedClosingTime) {
        const errorMessage = 'Closing time is required.'
        setClosingTimeError(errorMessage)
        showToast(errorMessage, { variant: 'error' })
        return
      }

      if (normalizedOpenDays.length === 0) {
        const errorMessage = 'Select at least one open day.'
        setOpenDaysError(errorMessage)
        showToast(errorMessage, { variant: 'error' })
        return
      }

      const payload = buildVeterinaryClinicPayload(addClinicForm)
      if (!payload) {
        showToast('Longitude and latitude must be valid numbers.', { variant: 'error' })
        return
      }

      setIsSavingClinic(true)

      try {
        if (editingClinicId) {
          await veterinaryClinicService.update(editingClinicId, payload, accessToken)
          showToast('Veterinary clinic updated successfully.', { variant: 'success' })
        } else {
          await veterinaryClinicService.create(payload, accessToken)
          showToast('Veterinary clinic added successfully.', { variant: 'success' })
        }

        closeAddModal()
        await loadClinics()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingClinic(false)
      }
    }

    void persistClinic()
  }

  const handleEditClinic = (clinic: VeterinaryClinic) => {
    setEditingClinicId(clinic.id)
    setAddClinicForm(mapVeterinaryClinicToForm(clinic))
    setContactNumberError('')
    setOpeningTimeError('')
    setClosingTimeError('')
    setOpenDaysError('')
    setIsAddModalOpen(true)
  }

  const handleDeleteClinicRequest = (clinic: VeterinaryClinic) => {
    setPendingDeleteClinic({
      id: clinic.id,
      name: clinic.name?.trim() || 'this clinic',
    })
  }

  const handleDeleteClinic = (clinicId: string) => {
    if (!accessToken) {
      setPendingDeleteClinic(null)
      showToast('You need to sign in before managing veterinary clinics.', { variant: 'error' })
      return
    }

    const deleteClinic = async () => {
      setClinicIdBeingDeleted(clinicId)

      try {
        await veterinaryClinicService.delete(clinicId, accessToken)
        setClinics((current) => current.filter((clinic) => clinic.id !== clinicId))
        setViewingClinic((current) => (current?.id === clinicId ? null : current))
        showToast('Veterinary clinic removed successfully.', { variant: 'success' })
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setPendingDeleteClinic(null)
        setClinicIdBeingDeleted(null)
      }
    }

    void deleteClinic()
  }

  const primaryViewingVideo = resolvePrimaryVideo(viewingClinic)
  const viewingClinicMapUrl = useMemo(
    () => buildReadOnlyMapPreviewUrl(viewingClinic?.latitude, viewingClinic?.long),
    [viewingClinic?.latitude, viewingClinic?.long],
  )
  const viewingOpenDayLabels = useMemo(
    () => getOpenDayLabels(viewingClinic?.openDays, 'full'),
    [viewingClinic?.openDays],
  )

  const handleViewEdit = () => {
    if (!viewingClinic) {
      return
    }

    const nextClinicToEdit = viewingClinic
    closeViewModal()
    handleEditClinic(nextClinicToEdit)
  }

  const handleViewDelete = () => {
    if (!viewingClinic) {
      return
    }

    handleDeleteClinicRequest(viewingClinic)
    closeViewModal()
  }

  const handleOpenDayToggle = (dayValue: string) => {
    setOpenDaysError('')

    setAddClinicForm((current) => {
      const currentOpenDays = new Set(parseOpenDayValues(current.openDays))

      if (currentOpenDays.has(dayValue)) {
        currentOpenDays.delete(dayValue)
      } else {
        currentOpenDays.add(dayValue)
      }

      return {
        ...current,
        openDays: serializeOpenDayValues(Array.from(currentOpenDays)),
      }
    })
  }

  const handleContactNumberChange = (index: number, nextValue: string) => {
    setContactNumberError('')

    setAddClinicForm((current) => {
      const nextContactNumbers = [...current.contactNumbers]
      nextContactNumbers[index] = nextValue

      return {
        ...current,
        contactNumbers: nextContactNumbers,
      }
    })
  }

  const handleAddContactNumberField = () => {
    setAddClinicForm((current) => ({
      ...current,
      contactNumbers: [...current.contactNumbers, ''],
    }))
  }

  const handleRemoveContactNumberField = (index: number) => {
    setContactNumberError('')

    setAddClinicForm((current) => {
      if (current.contactNumbers.length <= 1) {
        return {
          ...current,
          contactNumbers: [''],
        }
      }

      return {
        ...current,
        contactNumbers: current.contactNumbers.filter((_, currentIndex) => currentIndex !== index),
      }
    })
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
            setIsSidebarOpen((prevState) => !prevState)
          }}
        />
      }
      sidebar={
        <Sidebar
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
          <h1 className={styles.pageTitle}>Veterinary Clinic List</h1>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll} ref={tableScrollRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Logo</th>
                    <th scope="col">Clinic Name</th>
                    <th scope="col">Address</th>
                    <th scope="col">Opening Time</th>
                    <th scope="col">Closing Time</th>
                    <th scope="col">Open Days</th>
                    <th scope="col">Contact Numbers</th>
                    <th scope="col">Ratings</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoadingClinics ? (
                    skeletonRowIndexes.map((rowIndex) => (
                      <tr key={`clinic-skeleton-${rowIndex}`} aria-hidden="true">
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonImage}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonText}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonText}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonText}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonTextWide}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonText}`} />
                        </td>
                        <td>
                          <div className={`${styles.skeletonBlock} ${styles.skeletonAction}`} />
                        </td>
                      </tr>
                    ))
                  ) : filteredClinics.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={styles.tableStateCell}>
                        No veterinary clinics found.
                      </td>
                    </tr>
                  ) : (
                    visibleClinics.map((clinic) => {
                        const openDayLabels = getOpenDayLabels(clinic.openDays, 'short')
                        const visibleOpenDayLabels = openDayLabels.slice(0, 3)
                        const hiddenOpenDayCount = Math.max(0, openDayLabels.length - visibleOpenDayLabels.length)

                        return (
                          <tr
                            key={clinic.id}
                            className={styles.clickableRow}
                            onClick={() => {
                              setViewingClinic(clinic)
                            }}
                          >
                            <td>
                              <img
                                src={resolveClinicImage(clinic)}
                                alt={clinic.name ? `${clinic.name} logo` : 'Clinic logo'}
                                className={styles.petImage}
                              />
                            </td>
                            <td>{clinic.name || 'N/A'}</td>
                            <td>{clinic.locationAddress || 'N/A'}</td>
                            <td>{formatOpeningTimeWithMeridiem(clinic.openingTime)}</td>
                            <td>{formatOpeningTimeWithMeridiem(clinic.closingTime)}</td>
                            <td>
                              {openDayLabels.length > 0 ? (
                                <div className={styles.tableOpenDayList}>
                                  {visibleOpenDayLabels.map((label) => (
                                    <span key={`${clinic.id}-${label}`} className={`${styles.openDayChip} ${styles.openDayChipCompact}`}>
                                      {label}
                                    </span>
                                  ))}
                                  {hiddenOpenDayCount > 0 ? (
                                    <span className={`${styles.openDayChip} ${styles.openDayChipOverflow}`}>
                                      +{hiddenOpenDayCount}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                'N/A'
                              )}
                            </td>
                            <td>{formatListCell(clinic.contactNumbers)}</td>
                            <td>{clinic.ratings?.trim() || 'N/A'}</td>
                            <td>
                              <div className={styles.actionCell}>
                                <button
                                  type="button"
                                  className={styles.actionButton}
                                  aria-label={`Edit ${clinic.name || 'clinic'}`}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleEditClinic(clinic)
                                  }}
                                >
                                  <FaEdit aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.actionButton} ${styles.deleteButton}`}
                                  aria-label={`Delete ${clinic.name || 'clinic'}`}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleDeleteClinicRequest(clinic)
                                  }}
                                  disabled={clinicIdBeingDeleted === clinic.id}
                                >
                                  <FaTrashAlt aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                  )}
                </tbody>
              </table>

              {hasMoreClinicsToReveal ? (
                <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger} />
              ) : null}
            </div>

            <button
              type="button"
              className={styles.floatingAddButton}
              aria-label="Add veterinary clinic"
              onClick={() => {
                setEditingClinicId(null)
                setAddClinicForm(DEFAULT_ADD_VETERINARY_CLINIC_FORM)
                setContactNumberError('')
                setIsAddModalOpen(true)
              }}
            >
              <span className={styles.floatingAddIcon}>
                <FaPlus aria-hidden="true" />
              </span>
              <span className={styles.floatingAddLabel}>Add Clinic</span>
            </button>
          </div>

          <footer className={styles.tableFooter}>
            <span className={styles.footerText}>
              Showing {visibleClinics.length} of {filteredClinics.length}
            </span>
          </footer>
        </section>
      </div>

      {viewingClinic ? (
        <div className={styles.modalOverlay} onClick={closeViewModal}>
          <div
            className={`${styles.modalCard} ${styles.viewModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-veterinary-clinic-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="view-veterinary-clinic-modal-title" className={styles.modalTitle}>
                Veterinary Clinic Details
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeViewModal}
                aria-label="Close veterinary clinic details modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.viewModalBody}>
              <div className={styles.viewMedia}>
                <img
                  src={resolveClinicImage(viewingClinic)}
                  alt={viewingClinic.name ? `${viewingClinic.name} logo` : 'Clinic logo'}
                  className={styles.viewImage}
                />
                {primaryViewingVideo ? (
                  <video className={styles.viewVideo} controls preload="metadata">
                    <source src={primaryViewingVideo} />
                    Your browser does not support HTML video playback.
                  </video>
                ) : null}
              </div>

              <div className={styles.viewDetailsGrid}>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Name</span>
                  <span className={styles.viewDetailValue}>{viewingClinic.name || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Location Address</span>
                  <span className={styles.viewDetailValue}>{viewingClinic.locationAddress || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Opening Time</span>
                  <span className={styles.viewDetailValue}>
                    {formatOpeningTimeWithMeridiem(viewingClinic.openingTime)}
                  </span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Closing Time</span>
                  <span className={styles.viewDetailValue}>
                    {formatOpeningTimeWithMeridiem(viewingClinic.closingTime)}
                  </span>
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Location Map</span>
                  {viewingClinicMapUrl ? (
                    <iframe
                      title={viewingClinic.name ? `${viewingClinic.name} location map` : 'Clinic location map'}
                      src={viewingClinicMapUrl}
                      className={styles.viewMapFrame}
                      loading="lazy"
                    />
                  ) : (
                    <p className={styles.viewDescription}>N/A</p>
                  )}
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Ratings</span>
                  <span className={styles.viewDetailValue}>{viewingClinic.ratings || 'N/A'}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Created Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingClinic.createdDate)}</span>
                </div>
                <div className={styles.viewDetailItem}>
                  <span className={styles.viewDetailLabel}>Updated Date</span>
                  <span className={styles.viewDetailValue}>{formatDateLabel(viewingClinic.updatedDate)}</span>
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Open Days</span>
                  {viewingOpenDayLabels.length > 0 ? (
                    <div className={styles.viewOpenDayList}>
                      {viewingOpenDayLabels.map((label) => (
                        <span key={`${viewingClinic.id}-${label}`} className={styles.openDayChip}>
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.viewDescription}>N/A</p>
                  )}
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Contact Numbers</span>
                  <p className={styles.viewDescription}>{formatListDetails(viewingClinic.contactNumbers)}</p>
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Photos</span>
                  <p className={styles.viewDescription}>{formatListDetails(viewingClinic.photos)}</p>
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Videos</span>
                  <p className={styles.viewDescription}>{formatListDetails(viewingClinic.videos)}</p>
                </div>
                <div className={`${styles.viewDetailItem} ${styles.viewDetailItemWide}`}>
                  <span className={styles.viewDetailLabel}>Description</span>
                  <p className={styles.viewDescription}>{viewingClinic.description || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className={`${styles.modalActions} ${styles.viewModalActions}`}>
              <button type="button" className={styles.modalCancelButton} onClick={closeViewModal}>
                Close
              </button>
              <button type="button" className={styles.modalSubmitButton} onClick={handleViewEdit}>
                Edit
              </button>
              <button
                type="button"
                className={`${styles.modalSubmitButton} ${styles.viewDeleteButton}`}
                onClick={handleViewDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isAddModalOpen ? (
        <div className={styles.modalOverlay} onClick={closeAddModal}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-veterinary-clinic-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="add-veterinary-clinic-modal-title" className={styles.modalTitle}>
                {editingClinicId ? 'Edit Veterinary Clinic' : 'Add Veterinary Clinic'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeAddModal}
                aria-label="Close add veterinary clinic modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleAddClinicSubmit} noValidate>
              <div className={styles.modalFields}>
                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>
                    Clinic Name <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <input
                    type="text"
                    value={addClinicForm.name}
                    onChange={(event) => {
                      setAddClinicForm((current) => ({
                        ...current,
                        name: autoCapitalizeName(event.target.value),
                      }))
                    }}
                    className={styles.fieldInput}
                  />
                </label>

                <div className={styles.fieldLabelWide}>
                  <span className={styles.fieldLabelTitle}>
                    Location <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <LocationPickerMap
                    showCoordinateInputs={false}
                    value={{
                      address: addClinicForm.locationAddress,
                      latitude: addClinicForm.latitude,
                      longitude: addClinicForm.longitude,
                    }}
                    onChange={(nextLocation) => {
                      setAddClinicForm((current) => ({
                        ...current,
                        latitude: nextLocation.latitude,
                        locationAddress: nextLocation.address,
                        longitude: nextLocation.longitude,
                      }))
                    }}
                  />
                </div>

                <label className={styles.fieldLabel}>
                  <span>
                    Opening Time <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <TimePicker
                    value={addClinicForm.openingTime}
                    onChange={(nextValue) => {
                      setOpeningTimeError('')
                      setAddClinicForm((current) => ({ ...current, openingTime: nextValue }))
                    }}
                    placeholder="Select opening time"
                    ariaLabel="Select opening time"
                  />
                  {openingTimeError ? <span className={styles.fieldErrorText}>{openingTimeError}</span> : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>
                    Closing Time <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <TimePicker
                    value={addClinicForm.closingTime}
                    onChange={(nextValue) => {
                      setClosingTimeError('')
                      setAddClinicForm((current) => ({ ...current, closingTime: nextValue }))
                    }}
                    placeholder="Select closing time"
                    ariaLabel="Select closing time"
                  />
                  {closingTimeError ? <span className={styles.fieldErrorText}>{closingTimeError}</span> : null}
                </label>

                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>
                    Open Days <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <div
                    className={`${styles.openDaysControl}${openDaysError ? ` ${styles.openDaysControlError}` : ''}`}
                  >
                    <div className={styles.openDaysPills} role="group" aria-label="Clinic open days">
                      {OPEN_DAY_OPTIONS.map((option) => {
                        const isSelected = selectedOpenDays.includes(option.value)

                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.openDayPill}${isSelected ? ` ${styles.openDayPillActive}` : ''}`}
                            onClick={() => {
                              handleOpenDayToggle(option.value)
                            }}
                            aria-pressed={isSelected}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {openDaysError ? <span className={styles.fieldErrorText}>{openDaysError}</span> : null}
                </label>

                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>Ratings</span>
                  <div className={styles.ratingControl}>
                    <div className={styles.ratingMeta}>
                      <div className={styles.ratingStarsInput} role="radiogroup" aria-label="Clinic ratings">
                        {Array.from({ length: 5 }, (_, index) => {
                          const starValue = index + 1
                          const fullStars = Math.floor(ratingSliderValue)
                          const hasHalfStar = ratingSliderValue - fullStars >= 0.5
                          const isFilled = starValue <= fullStars
                          const isHalf = !isFilled && starValue === fullStars + 1 && hasHalfStar

                          return (
                            <button
                              key={`rating-star-${index}`}
                              type="button"
                              className={`${styles.ratingStarButton}${!isFilled ? ` ${styles.ratingStarButtonEmpty}` : ''}`}
                              onClick={() => {
                                setAddClinicForm((current) => ({
                                  ...current,
                                  ratings: starValue.toFixed(1),
                                }))
                              }}
                              aria-label={`Set rating to ${starValue}`}
                              aria-pressed={isFilled}
                            >
                              {isFilled ? <FaStar /> : isHalf ? <FaStarHalfAlt /> : <FaRegStar />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      value={ratingSliderValue}
                      onChange={(event) => {
                        const nextValue = Number.parseFloat(event.target.value)
                        setAddClinicForm((current) => ({
                          ...current,
                          ratings: Number.isFinite(nextValue) ? nextValue.toFixed(1) : '',
                        }))
                      }}
                      className={styles.ratingSlider}
                    />
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.1"
                      value={addClinicForm.ratings}
                      onChange={(event) => {
                        setAddClinicForm((current) => ({
                          ...current,
                          ratings: event.target.value,
                        }))
                      }}
                      onBlur={() => {
                        const parsed = Number.parseFloat(addClinicForm.ratings)
                        setAddClinicForm((current) => ({
                          ...current,
                          ratings: Number.isFinite(parsed)
                            ? Math.min(5, Math.max(0, parsed)).toFixed(1)
                            : '',
                        }))
                      }}
                      className={`${styles.fieldInput} ${styles.ratingNumberInput}`}
                      placeholder="Enter rating (0.0 to 5.0)"
                    />
                  </div>
                </label>

                <div className={styles.fieldLabelWide}>
                  <PhotoUploadField
                    cropAspectRatio={1}
                    value={addClinicForm.logo}
                    onChange={(nextLogo) => {
                      setAddClinicForm((current) => ({ ...current, logo: nextLogo }))
                    }}
                    onNotify={(message, variant) => {
                      showToast(message, { variant })
                    }}
                    title="Clinic Logo"
                    subtitle="Upload a logo image from your device or camera."
                    previewAlt={addClinicForm.name ? `${addClinicForm.name} logo` : 'Clinic logo preview'}
                    uploadFolder="veterinary-clinics/logos"
                  />
                </div>

                <div className={styles.fieldLabelWide}>
                  <PhotoUploadField
                    value={addClinicForm.photo}
                    onChange={(nextPhoto) => {
                      setAddClinicForm((current) => ({ ...current, photo: nextPhoto }))
                    }}
                    onNotify={(message, variant) => {
                      showToast(message, { variant })
                    }}
                    title="Clinic Photo"
                    subtitle="Upload the primary clinic photo from your device or camera."
                    previewAlt={addClinicForm.name ? `${addClinicForm.name} photo` : 'Clinic photo preview'}
                    uploadFolder="veterinary-clinics/photos"
                  />
                </div>

                <div className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>
                    Contact Numbers <span className={styles.requiredAsterisk}>*</span>
                  </span>
                  <div className={styles.contactNumbersControl}>
                    {addClinicForm.contactNumbers.map((contactNumber, index) => (
                      <div key={`contact-number-input-${index}`} className={styles.contactNumberRow}>
                        <input
                          type="tel"
                          inputMode="tel"
                          pattern="^\\+?[0-9]{7,15}$"
                          value={contactNumber}
                          onChange={(event) => {
                            handleContactNumberChange(index, event.target.value)
                          }}
                          className={`${styles.fieldInput}${contactNumberError ? ` ${styles.fieldInputError}` : ''}`}
                          placeholder="+639171234567"
                        />
                        <button
                          type="button"
                          className={styles.contactRemoveButton}
                          onClick={() => {
                            handleRemoveContactNumberField(index)
                          }}
                          aria-label={`Remove contact number ${index + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      className={styles.contactAddButton}
                      onClick={handleAddContactNumberField}
                    >
                      Add Number
                    </button>
                  </div>
                  {contactNumberError ? (
                    <span className={styles.fieldErrorText}>{contactNumberError}</span>
                  ) : null}
                </div>

                <div className={styles.fieldLabelWide}>
                  <VideoUploadField
                    value={addClinicForm.video}
                    onChange={(nextVideo) => {
                      setAddClinicForm((current) => ({ ...current, video: nextVideo }))
                    }}
                    onNotify={(message, variant) => {
                      showToast(message, { variant })
                    }}
                    title="Clinic Video"
                    subtitle="Upload or record the primary clinic video."
                    uploadFolder="veterinary-clinics/videos"
                    maxDurationSeconds={60}
                    maxSizeMb={30}
                  />
                </div>

                <label className={`${styles.fieldLabel} ${styles.fieldLabelWide}`}>
                  <span>Description</span>
                  <textarea
                    value={addClinicForm.description}
                    onChange={(event) => {
                      setAddClinicForm((current) => ({ ...current, description: event.target.value }))
                    }}
                    className={styles.fieldTextarea}
                    rows={4}
                  />
                </label>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancelButton} onClick={closeAddModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.modalSubmitButton} disabled={isSavingClinic}>
                  {isSavingClinic ? 'Saving...' : editingClinicId ? 'Save' : 'Add Clinic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingDeleteClinic)}
        title="Delete veterinary clinic?"
        message={`Are you sure you want to delete ${pendingDeleteClinic?.name ?? 'this clinic'}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete veterinary clinic confirmation"
        isBusy={clinicIdBeingDeleted !== null}
        onCancel={() => {
          setPendingDeleteClinic(null)
        }}
        onConfirm={() => {
          if (pendingDeleteClinic) {
            handleDeleteClinic(pendingDeleteClinic.id)
          }
        }}
      />
    </MainLayout>
  )
}

export default VeterinaryClinicListPage
