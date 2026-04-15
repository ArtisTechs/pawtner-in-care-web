import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaFilter,
  FaMapMarkerAlt,
  FaSpinner,
  FaSyncAlt,
  FaTimes,
  FaTrash,
} from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { companySettingsService } from '@/features/company-settings/services/company-settings.service'
import type { CompanyAddressPayload } from '@/features/company-settings/types/company-settings-api'
import { emergencySosService } from '@/features/emergency-sos/services/emergency-sos.service'
import type {
  EmergencySos,
  EmergencySosStatus,
  EmergencySosType,
  UpdateEmergencySosPayload,
} from '@/features/emergency-sos/types/emergency-sos-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { ApiError, getErrorMessage } from '@/shared/api/api-error'
import DateMultiSelectPicker from '@/shared/components/ui/DateMultiSelectPicker/DateMultiSelectPicker'
import Toast from '@/shared/components/feedback/Toast'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import PillMultiSelectDropdown from '@/shared/components/ui/PillMultiSelectDropdown/PillMultiSelectDropdown'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './EmergencySosListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'emergency-sos'
const DEFAULT_TYPE_OPTIONS: ReadonlyArray<EmergencySosType> = ['INJURED', 'ACCIDENTS', 'RANDOM_STRAY']
const DEFAULT_STATUS_OPTIONS: ReadonlyArray<EmergencySosStatus> = ['REQUESTED', 'REJECTED', 'ONGOING', 'RESCUED']

type EmergencySosRow = {
  addressLocation: string
  additionalLocationMessage: string
  createdAt?: string | null
  createdAtLabel: string
  dateKey: string
  description: string
  item: EmergencySos
  photo: string
  personFilledEmail: string
  personFilledId: string
  reportId: string
  reporterName: string
  sortTime: number
  status: EmergencySosStatus
  statusLabel: string
  type: EmergencySosType
  typeLabel: string
}

type PendingConfirmationAction =
  | {
      kind: 'delete-request'
      request: EmergencySosRow
    }
  | {
      kind: 'update-status'
      status: EmergencySosStatus
    }

type CompanyAddressOption = CompanyAddressPayload & {
  id: string
}

const areDateSelectionsEqual = (leftValues: string[], rightValues: string[]) => {
  if (leftValues.length !== rightValues.length) {
    return false
  }

  return leftValues.every((leftValue, index) => leftValue === rightValues[index])
}

const STATUS_UI: Record<
  EmergencySosStatus,
  {
    badgeClassName: string
    label: string
  }
> = {
  ONGOING: {
    badgeClassName: 'statusProcessing',
    label: 'Ongoing',
  },
  ONGOING_RESCUE: {
    badgeClassName: 'statusProcessing',
    label: 'Ongoing',
  },
  REJECTED: {
    badgeClassName: 'statusCancelled',
    label: 'Rejected',
  },
  REQUESTED: {
    badgeClassName: 'statusOnHold',
    label: 'Requested',
  },
  RESCUED: {
    badgeClassName: 'statusCompleted',
    label: 'Rescued',
  },
}

const TYPE_LABELS: Record<EmergencySosType, string> = {
  ACCIDENTS: 'Accidents',
  INJURED: 'Injured',
  RANDOM_STRAY: 'Random Stray',
}

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

const toDateKey = (value?: string | null) => {
  if (!value) {
    return ''
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  const year = parsedDate.getFullYear()
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
  const day = String(parsedDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toSortTime = (value?: string | null) => {
  if (!value) {
    return 0
  }

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

const normalizeText = (value?: string | null) => value?.trim() || ''
const normalizeStatus = (status?: string | null): EmergencySosStatus => {
  if (!status) {
    return 'REQUESTED'
  }

  return status === 'ONGOING_RESCUE' ? 'ONGOING' : (status as EmergencySosStatus)
}

const toReporterName = (item: EmergencySos) => {
  const person = item.personFilled
  const personFullName = normalizeText(person?.fullName)
  if (personFullName) {
    return personFullName
  }

  const composedName = [person?.firstName, person?.middleName, person?.lastName]
    .map((namePart) => normalizeText(namePart))
    .filter(Boolean)
    .join(' ')
  if (composedName) {
    return composedName
  }

  const fallbackName =
    normalizeText(person?.name) ||
    normalizeText(person?.userName) ||
    normalizeText(item.personFilledFullName) ||
    normalizeText(item.personFilledName)
  if (fallbackName) {
    return fallbackName
  }

  return 'Unknown Reporter'
}

const toStatusLabel = (status?: string | null) => {
  if (!status) {
    return 'Unknown'
  }

  const mappedStatus = STATUS_UI[status as EmergencySosStatus]
  if (mappedStatus) {
    return mappedStatus.label
  }

  return status
    .trim()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

const toTypeLabel = (type?: string | null) => {
  if (!type) {
    return 'Unknown'
  }

  return TYPE_LABELS[type as EmergencySosType] ?? type
}

const mapSosRow = (item: EmergencySos): EmergencySosRow => {
  const createdAt = item.createdAt ?? item.updatedAt
  const status = normalizeStatus(item.status)
  const type = (item.type as EmergencySosType) ?? 'INJURED'

  return {
    additionalLocationMessage: item.additionalLocationMessage?.trim() || '',
    addressLocation: item.addressLocation?.trim() || 'N/A',
    createdAt,
    createdAtLabel: formatDateLabel(createdAt),
    dateKey: toDateKey(createdAt),
    description: item.description?.trim() || '',
    item,
    photo: item.photo?.trim() || '',
    personFilledEmail: item.personFilled?.email?.trim() || item.personFilledEmail?.trim() || '',
    personFilledId: item.personFilled?.id?.trim() || item.personFilledId?.trim() || '',
    reportId: item.id,
    reporterName: toReporterName(item),
    sortTime: toSortTime(createdAt),
    status,
    statusLabel: toStatusLabel(status),
    type,
    typeLabel: toTypeLabel(type),
  }
}

interface EmergencySosListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function EmergencySosListPage({ onLogout, session }: EmergencySosListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [rows, setRows] = useState<EmergencySosRow[]>([])
  const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([])
  const [selectedTypeValues, setSelectedTypeValues] = useState<EmergencySosType[]>([])
  const [selectedStatusValues, setSelectedStatusValues] = useState<EmergencySosStatus[]>([])
  const [selectedSosForAction, setSelectedSosForAction] = useState<EmergencySosRow | null>(null)
  const [pendingConfirmationAction, setPendingConfirmationAction] = useState<PendingConfirmationAction | null>(null)
  const [typeOptions, setTypeOptions] = useState<EmergencySosType[]>([...DEFAULT_TYPE_OPTIONS])
  const [statusOptions, setStatusOptions] = useState<EmergencySosStatus[]>([...DEFAULT_STATUS_OPTIONS])
  const [companyAddressOptions, setCompanyAddressOptions] = useState<CompanyAddressOption[]>([])
  const [isLoadingCompanyAddresses, setIsLoadingCompanyAddresses] = useState(false)
  const [isOngoingAddressModalOpen, setIsOngoingAddressModalOpen] = useState(false)
  const [selectedOngoingAddressId, setSelectedOngoingAddressId] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const lastAutoLoadedTokenRef = useRef<string | null>(null)
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''

  const loadEmergencySos = useCallback(async () => {
    if (!accessToken) {
      setRows([])
      setTypeOptions([...DEFAULT_TYPE_OPTIONS])
      setStatusOptions([...DEFAULT_STATUS_OPTIONS])
      return
    }

    setIsLoadingLogs(true)

    try {
      const [requests, fetchedTypes, fetchedStatuses] = await Promise.all([
        emergencySosService.list(accessToken, {
          ignorePagination: true,
          sortBy: 'createdAt',
          sortDir: 'desc',
        }),
        emergencySosService.listTypes(accessToken).catch(() => []),
        emergencySosService.listStatuses(accessToken).catch(() => []),
      ])

      const nextRows = requests.map(mapSosRow)
      const sortedRows = [...nextRows].sort((leftRow, rightRow) => rightRow.sortTime - leftRow.sortTime)
      setRows(sortedRows)

      setTypeOptions(
        fetchedTypes.length
          ? (Array.from(new Set(fetchedTypes)) as EmergencySosType[])
          : [...DEFAULT_TYPE_OPTIONS],
      )
      setStatusOptions(
        fetchedStatuses.length
          ? (Array.from(new Set(fetchedStatuses.map((status) => normalizeStatus(status)))) as EmergencySosStatus[])
          : [...DEFAULT_STATUS_OPTIONS],
      )
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingLogs(false)
    }
  }, [accessToken, showToast])

  const loadCompanyAddresses = useCallback(async () => {
    if (!accessToken) {
      setCompanyAddressOptions([])
      setIsLoadingCompanyAddresses(false)
      return
    }

    setIsLoadingCompanyAddresses(true)

    try {
      const settings = await companySettingsService.get(accessToken)
      const nextCompanyAddressOptions = (settings.addresses ?? [])
        .map((address, index) => ({
          ...address,
          id: `company-address-${index + 1}`,
        }))
        .filter(
          (address) =>
            Boolean(address.address?.trim()) && Number.isFinite(address.latitude) && Number.isFinite(address.long),
        )

      setCompanyAddressOptions(nextCompanyAddressOptions)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setCompanyAddressOptions([])
        return
      }

      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingCompanyAddresses(false)
    }
  }, [accessToken, showToast])

  useEffect(() => {
    clearToast()

    if (!accessToken) {
      lastAutoLoadedTokenRef.current = null
      setRows([])
      return
    }

    if (lastAutoLoadedTokenRef.current === accessToken) {
      return
    }

    lastAutoLoadedTokenRef.current = accessToken
    void loadEmergencySos()
  }, [accessToken, clearToast, loadEmergencySos])

  useEffect(() => {
    if (!accessToken) {
      setCompanyAddressOptions([])
      setIsOngoingAddressModalOpen(false)
      setSelectedOngoingAddressId('')
      return
    }

    void loadCompanyAddresses()
  }, [accessToken, loadCompanyAddresses])

  const dateOptions = useMemo(() => {
    const uniqueDateKeys = Array.from(
      new Set(
        rows
          .map((row) => row.dateKey)
          .filter(Boolean),
      ),
    ).sort((left, right) => right.localeCompare(left))

    return uniqueDateKeys.map((dateKey) => ({
      label: formatDateLabel(dateKey),
      value: dateKey,
    }))
  }, [rows])

  useEffect(() => {
    if (!dateOptions.length) {
      return
    }

    setSelectedDateKeys((currentDateKeys) => {
      if (currentDateKeys.length > 0) {
        return currentDateKeys
      }

      return [dateOptions[0].value]
    })
  }, [dateOptions])

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    return rows.filter((row) => {
      if (selectedDateKeys.length > 0 && !selectedDateKeys.includes(row.dateKey)) {
        return false
      }

      if (selectedTypeValues.length > 0 && !selectedTypeValues.includes(row.type)) {
        return false
      }

      if (selectedStatusValues.length > 0 && !selectedStatusValues.includes(row.status)) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return (
        row.reportId.toLowerCase().includes(normalizedSearch) ||
        row.reporterName.toLowerCase().includes(normalizedSearch) ||
        row.personFilledEmail.toLowerCase().includes(normalizedSearch) ||
        row.addressLocation.toLowerCase().includes(normalizedSearch) ||
        row.additionalLocationMessage.toLowerCase().includes(normalizedSearch) ||
        row.description.toLowerCase().includes(normalizedSearch) ||
        row.type.toLowerCase().includes(normalizedSearch) ||
        row.typeLabel.toLowerCase().includes(normalizedSearch) ||
        row.status.toLowerCase().includes(normalizedSearch) ||
        row.statusLabel.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [rows, searchValue, selectedDateKeys, selectedTypeValues, selectedStatusValues])

  const primarySelectedDateKey = selectedDateKeys[0] || ''

  const selectedDateIndex = useMemo(() => {
    if (!primarySelectedDateKey) {
      return -1
    }

    return dateOptions.findIndex((option) => option.value === primarySelectedDateKey)
  }, [dateOptions, primarySelectedDateKey])

  const hasPrevDate = selectedDateIndex >= 0 && selectedDateIndex < dateOptions.length - 1
  const hasNextDate = selectedDateIndex > 0

  const applyDateSelection = useCallback(
    (nextDateKeys: string[]) => {
      const normalizedDateKeys = [...nextDateKeys].sort((left, right) => right.localeCompare(left))
      if (areDateSelectionsEqual(normalizedDateKeys, selectedDateKeys)) {
        return
      }

      setSelectedDateKeys(normalizedDateKeys)
    },
    [selectedDateKeys],
  )

  const handlePrevDate = () => {
    if (!hasPrevDate) {
      return
    }

    const nextDateOption = dateOptions[selectedDateIndex + 1]
    if (!nextDateOption) {
      return
    }

    applyDateSelection([nextDateOption.value])
  }

  const handleNextDate = () => {
    if (!hasNextDate) {
      return
    }

    const nextDateOption = dateOptions[selectedDateIndex - 1]
    if (!nextDateOption) {
      return
    }

    applyDateSelection([nextDateOption.value])
  }

  const handleResetFilters = () => {
    setSelectedTypeValues([])
    setSelectedStatusValues([])
    const resetDateKeys = dateOptions[0] ? [dateOptions[0].value] : []
    applyDateSelection(resetDateKeys)
  }

  const selectedOngoingAddress = useMemo(
    () => companyAddressOptions.find((address) => address.id === selectedOngoingAddressId) ?? null,
    [companyAddressOptions, selectedOngoingAddressId],
  )

  const closeModal = () => {
    if (isUpdatingStatus) {
      return
    }

    setSelectedSosForAction(null)
    setPendingConfirmationAction(null)
    setIsOngoingAddressModalOpen(false)
    setSelectedOngoingAddressId('')
  }

  const buildUpdatePayload = (
    selected: EmergencySosRow,
    status: EmergencySosStatus,
    rescueFromAddress?: CompanyAddressOption | null,
  ): UpdateEmergencySosPayload | null => {
    const source = selected.item
    const personFilledId = selected.personFilledId || source.personFilledId?.trim() || source.personFilled?.id?.trim() || ''
    const addressLocation = source.addressLocation?.trim() || selected.addressLocation
    const type = (source.type as EmergencySosType) ?? selected.type
    const latitude = source.latitude
    const longitude = source.long
    const normalizedStatus = normalizeStatus(status)
    const nextRescueFromAddress =
      normalizedStatus === 'ONGOING'
        ? rescueFromAddress?.address?.trim() || ''
        : source.rescueFromAddress?.trim() || ''
    const nextRescueFromLat = normalizedStatus === 'ONGOING' ? rescueFromAddress?.latitude : source.rescueFromLat
    const nextRescueFromLong = normalizedStatus === 'ONGOING' ? rescueFromAddress?.long : source.rescueFromLong

    if (!personFilledId || !addressLocation || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null
    }

    if (
      normalizedStatus === 'ONGOING' &&
      (!nextRescueFromAddress || typeof nextRescueFromLat !== 'number' || typeof nextRescueFromLong !== 'number')
    ) {
      return null
    }

    return {
      additionalLocationMessage: source.additionalLocationMessage?.trim() || undefined,
      addressLocation,
      description: source.description?.trim() || undefined,
      latitude,
      long: longitude,
      photo: source.photo?.trim() || undefined,
      personFilledId,
      rescueFromAddress: nextRescueFromAddress || undefined,
      rescueFromLat: typeof nextRescueFromLat === 'number' ? nextRescueFromLat : undefined,
      rescueFromLong: typeof nextRescueFromLong === 'number' ? nextRescueFromLong : undefined,
      status: normalizedStatus,
      type,
    }
  }

  const handleUpdateStatus = (status: EmergencySosStatus, rescueFromAddress?: CompanyAddressOption | null) => {
    if (!selectedSosForAction) {
      return
    }

    if (!accessToken) {
      showToast('You need to sign in before updating an SOS request.', { variant: 'error' })
      return
    }

    const normalizedStatus = normalizeStatus(status)
    if (selectedSosForAction.status === normalizedStatus) {
      showToast('Selected SOS request already has this status.', { variant: 'error' })
      return
    }

    const payload = buildUpdatePayload(selectedSosForAction, normalizedStatus, rescueFromAddress)
    if (!payload) {
      showToast('Missing required SOS fields for update. Please refresh and try again.', { variant: 'error' })
      return
    }

    const updateRequestStatus = async () => {
      setIsUpdatingStatus(true)

      try {
        await emergencySosService.update(selectedSosForAction.reportId, payload, accessToken)
        setSelectedSosForAction(null)
        setIsOngoingAddressModalOpen(false)
        setSelectedOngoingAddressId('')
        setPendingConfirmationAction(null)
        showToast('Emergency SOS status updated successfully.', { variant: 'success' })
        await loadEmergencySos()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsUpdatingStatus(false)
      }
    }

    void updateRequestStatus()
  }

  const handleDeleteRequest = () => {
    if (!selectedSosForAction || !accessToken) {
      return
    }

    const deleteRequest = async () => {
      setIsUpdatingStatus(true)

      try {
        await emergencySosService.delete(selectedSosForAction.reportId, accessToken)
        setSelectedSosForAction(null)
        setIsOngoingAddressModalOpen(false)
        setSelectedOngoingAddressId('')
        setPendingConfirmationAction(null)
        showToast('Emergency SOS request deleted successfully.', { variant: 'success' })
        await loadEmergencySos()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsUpdatingStatus(false)
      }
    }

    void deleteRequest()
  }

  const handleOpenOngoingAddressModal = () => {
    if (!selectedSosForAction) {
      return
    }

    if (isLoadingCompanyAddresses) {
      showToast('Loading company addresses. Please try again.', { variant: 'error' })
      return
    }

    if (companyAddressOptions.length === 0) {
      showToast('No company address found. Please update Company Settings first.', { variant: 'error' })
      return
    }

    const preferredAddress = selectedOngoingAddress ?? companyAddressOptions[0]
    if (!preferredAddress) {
      showToast('No company address found. Please update Company Settings first.', { variant: 'error' })
      return
    }

    setSelectedOngoingAddressId(preferredAddress.id)
    setIsOngoingAddressModalOpen(true)
  }

  const handleConfirmOngoingAddress = () => {
    if (!selectedOngoingAddress) {
      showToast('Please select where the rescue team will come from.', { variant: 'error' })
      return
    }

    handleUpdateStatus('ONGOING', selectedOngoingAddress)
  }

  const getConfirmationDialogContent = useCallback(() => {
    if (!pendingConfirmationAction || !selectedSosForAction) {
      return null
    }

    if (pendingConfirmationAction.kind === 'delete-request') {
      return {
        ariaLabel: 'Delete emergency SOS confirmation',
        cancelLabel: 'Cancel',
        confirmLabel: 'Delete',
        confirmTone: 'danger' as const,
        message: `Delete SOS request ${pendingConfirmationAction.request.reportId}? This cannot be undone.`,
        title: 'Delete emergency SOS?',
      }
    }

    const statusLabel = toStatusLabel(pendingConfirmationAction.status).toLowerCase()
    return {
      ariaLabel: `Confirm ${statusLabel} emergency SOS status`,
      cancelLabel: 'No',
      confirmLabel: 'Yes',
      confirmTone: pendingConfirmationAction.status === 'RESCUED' ? ('success' as const) : ('danger' as const),
      message: `Are you sure you want to set this SOS request to ${statusLabel}?`,
      title: `Confirm ${statusLabel}`,
    }
  }, [pendingConfirmationAction, selectedSosForAction])

  const confirmationDialogContent = getConfirmationDialogContent()

  const handleConfirmationAction = () => {
    if (!pendingConfirmationAction) {
      return
    }

    if (pendingConfirmationAction.kind === 'delete-request') {
      handleDeleteRequest()
      setPendingConfirmationAction(null)
      return
    }

    if (pendingConfirmationAction.status === 'ONGOING') {
      setPendingConfirmationAction(null)
      handleOpenOngoingAddressModal()
      return
    }

    handleUpdateStatus(pendingConfirmationAction.status)
    setPendingConfirmationAction(null)
  }

  const canSetRejected = selectedSosForAction?.status !== 'REJECTED'
  const canSetOngoing = selectedSosForAction?.status !== 'ONGOING'
  const canSetRescued = selectedSosForAction?.status !== 'RESCUED'
  const hasCompanyAddressOptions = companyAddressOptions.length > 0
  const shouldShowRejectedAction = selectedSosForAction?.status !== 'ONGOING'
  const shouldShowDeleteAction = selectedSosForAction?.status !== 'ONGOING'
  const shouldShowStatusActions =
    selectedSosForAction?.status !== 'RESCUED' && selectedSosForAction?.status !== 'REJECTED'

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
          <h1 className={styles.pageTitle}>Emergency SOS Logs</h1>

          <div className={styles.filterBar}>
            <div className={`${styles.filterCell} ${styles.filterByCell}`}>
              <FaFilter aria-hidden="true" />
              <span>Filter By</span>
            </div>

            <div className={`${styles.filterCell} ${styles.dateFilterCell}`}>
              <DateMultiSelectPicker
                availableDateKeys={dateOptions.map((option) => option.value)}
                selectedDateKeys={selectedDateKeys}
                onApply={applyDateSelection}
              />
            </div>

            <label className={styles.filterCell}>
              <PillMultiSelectDropdown
                options={typeOptions.map((typeOption) => ({
                  label: toTypeLabel(typeOption),
                  value: typeOption,
                }))}
                selectedValues={selectedTypeValues}
                placeholder="SOS Type"
                panelTitle="Select SOS Type"
                helperText="*You can choose multiple SOS types"
                onApply={(values) => {
                  setSelectedTypeValues(values as EmergencySosType[])
                }}
              />
            </label>

            <label className={styles.filterCell}>
              <PillMultiSelectDropdown
                options={statusOptions.map((statusOption) => ({
                  label: toStatusLabel(statusOption),
                  value: statusOption,
                }))}
                selectedValues={selectedStatusValues}
                placeholder="SOS Status"
                panelTitle="Select SOS Status"
                helperText="*You can choose multiple SOS statuses"
                panelAlign="right"
                onApply={(values) => {
                  setSelectedStatusValues(values as EmergencySosStatus[])
                }}
              />
            </label>

            <button type="button" className={styles.resetButton} onClick={handleResetFilters}>
              <FaSyncAlt aria-hidden="true" />
              <span>Reset Filter</span>
            </button>
          </div>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Photo</th>
                    <th scope="col">Reporter</th>
                    <th scope="col">Address</th>
                    <th scope="col">Date</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingLogs ? (
                    Array.from({ length: 8 }, (_, rowIndex) => (
                      <tr key={`emergency-sos-skeleton-${rowIndex}`} aria-hidden="true">
                        <td colSpan={6}>
                          <div className={styles.rowSkeleton} />
                        </td>
                      </tr>
                    ))
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyStateCell}>
                        No emergency SOS logs found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const statusUi = STATUS_UI[row.status] ?? {
                        badgeClassName: 'statusCancelled',
                        label: row.statusLabel,
                      }

                      return (
                        <tr
                          key={row.reportId}
                          className={styles.clickableRow}
                          onClick={() => {
                            setSelectedSosForAction(row)
                          }}
                        >
                          <td>
                            {row.photo ? (
                              <img
                                src={row.photo}
                                alt={`SOS ${row.reportId} report`}
                                className={styles.photoThumbnail}
                                loading="lazy"
                              />
                            ) : (
                              <span className={styles.photoPlaceholder}>No photo</span>
                            )}
                          </td>
                          <td>{row.reporterName}</td>
                          <td>{row.addressLocation}</td>
                          <td>{row.createdAtLabel}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${styles.typeBadge}`}>{row.typeLabel}</span>
                          </td>
                          <td>
                            <span className={`${styles.statusBadge} ${styles[statusUi.badgeClassName]}`}>
                              {statusUi.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <footer className={styles.footerNav}>
            <button
              type="button"
              className={styles.dateNavButton}
              onClick={handlePrevDate}
              disabled={!hasPrevDate}
            >
              <FaChevronLeft aria-hidden="true" />
              <span>Prev. Date</span>
            </button>

            <button
              type="button"
              className={styles.dateNavButton}
              onClick={handleNextDate}
              disabled={!hasNextDate}
            >
              <span>Next Date</span>
              <FaChevronRight aria-hidden="true" />
            </button>
          </footer>
        </section>
      </div>

      {selectedSosForAction ? (
        <div
          className={styles.modalOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget && !isUpdatingStatus) {
              closeModal()
            }
          }}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergency-sos-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="emergency-sos-modal-title" className={styles.modalTitle}>
                Update Emergency SOS
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeModal()
                }}
                aria-label="Close emergency SOS modal"
                disabled={isUpdatingStatus}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.modalForm}>
              <div className={styles.modalFields}>
                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Reporter</span>
                  <span className={styles.modalMetaValue}>{selectedSosForAction.reporterName}</span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Type</span>
                  <span className={styles.modalMetaValue}>{selectedSosForAction.typeLabel}</span>
                </div>

                <div className={styles.fieldLabel}>
                  <span>Photo</span>
                  {selectedSosForAction.photo ? (
                    <div className={styles.modalPhotoFrame}>
                      <img
                        src={selectedSosForAction.photo}
                        alt={`SOS ${selectedSosForAction.reportId} report`}
                        className={styles.modalPhoto}
                      />
                    </div>
                  ) : (
                    <div className={styles.fieldDisplay}>No photo provided</div>
                  )}
                </div>

                <div className={styles.fieldLabel}>
                  <span>Address</span>
                  <div className={styles.fieldTextView}>{selectedSosForAction.addressLocation}</div>
                </div>

                {selectedSosForAction.additionalLocationMessage ? (
                  <div className={styles.fieldLabel}>
                    <span>Additional Location Message</span>
                    <div className={styles.fieldTextView}>{selectedSosForAction.additionalLocationMessage}</div>
                  </div>
                ) : null}

                {selectedSosForAction.description ? (
                  <div className={styles.fieldLabel}>
                    <span>Description</span>
                    <div className={styles.fieldTextView}>{selectedSosForAction.description}</div>
                  </div>
                ) : null}

                <div className={styles.fieldLabel}>
                  <span>Current Status</span>
                  <div className={styles.fieldDisplay}>
                    {selectedSosForAction.status} ({selectedSosForAction.statusLabel})
                  </div>
                </div>
              </div>

              <div className={styles.modalActions}>
                {shouldShowStatusActions ? (
                  <>
                    {!isLoadingCompanyAddresses && !hasCompanyAddressOptions ? (
                      <p className={styles.modalAddressHint}>
                        Add at least one company address in Company Settings to set an SOS to ongoing.
                      </p>
                    ) : null}

                    <div className={styles.modalIconActions}>
                      {shouldShowRejectedAction ? (
                        <button
                          type="button"
                          className={`${styles.modalIconButton} ${styles.modalRejectButton}`}
                          onClick={() => {
                            setPendingConfirmationAction({ kind: 'update-status', status: 'REJECTED' })
                          }}
                          disabled={isUpdatingStatus || !canSetRejected}
                          aria-label="Set emergency SOS to rejected"
                          title="Set to Rejected"
                        >
                          <FaTimes aria-hidden="true" />
                          <span className={styles.modalIconLabel}>Rejected</span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className={`${styles.modalIconButton} ${styles.modalOngoingButton}`}
                        onClick={handleOpenOngoingAddressModal}
                        disabled={
                          isUpdatingStatus ||
                          !canSetOngoing ||
                          isLoadingCompanyAddresses ||
                          !hasCompanyAddressOptions
                        }
                        aria-label="Set emergency SOS to ongoing"
                        title="Set to Ongoing"
                      >
                        <FaSpinner aria-hidden="true" />
                        <span className={styles.modalIconLabel}>Ongoing</span>
                      </button>

                      <button
                        type="button"
                        className={`${styles.modalIconButton} ${styles.modalApproveButton}`}
                        onClick={() => {
                          setPendingConfirmationAction({ kind: 'update-status', status: 'RESCUED' })
                        }}
                        disabled={isUpdatingStatus || !canSetRescued}
                        aria-label="Set emergency SOS to rescued"
                        title="Set to Rescued"
                      >
                        <FaCheck aria-hidden="true" />
                        <span className={styles.modalIconLabel}>Rescued</span>
                      </button>

                      {shouldShowDeleteAction ? (
                        <button
                          type="button"
                          className={`${styles.modalIconButton} ${styles.modalDeleteButton}`}
                          onClick={() => {
                            setPendingConfirmationAction({ kind: 'delete-request', request: selectedSosForAction })
                          }}
                          disabled={isUpdatingStatus}
                          aria-label="Delete emergency SOS"
                          title="Delete SOS"
                        >
                          <FaTrash aria-hidden="true" />
                          <span className={styles.modalIconLabel}>Delete</span>
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className={styles.modalAddressHint}>
                    No actions available for {selectedSosForAction?.statusLabel.toLowerCase()} SOS.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isOngoingAddressModalOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget && !isUpdatingStatus) {
              setIsOngoingAddressModalOpen(false)
              setSelectedOngoingAddressId('')
            }
          }}
        >
          <div
            className={styles.addressSelectionCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ongoing-address-selection-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="ongoing-address-selection-title" className={styles.modalTitle}>
                Rescue Team Origin
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  setIsOngoingAddressModalOpen(false)
                  setSelectedOngoingAddressId('')
                }}
                aria-label="Close rescue origin modal"
                disabled={isUpdatingStatus}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.addressSelectionBody}>
              <p className={styles.addressSelectionHint}>
                Choose where the rescue team will come from when setting this SOS to ongoing.
              </p>

              <div className={styles.addressSelectionList}>
                {companyAddressOptions.map((addressOption) => {
                  const isSelected = selectedOngoingAddressId === addressOption.id

                  return (
                    <label
                      key={addressOption.id}
                      className={`${styles.addressOption} ${isSelected ? styles.addressOptionActive : ''}`}
                    >
                      <input
                        type="radio"
                        name="ongoing-address-option"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedOngoingAddressId(addressOption.id)
                        }}
                        disabled={isUpdatingStatus}
                      />
                      <div className={styles.addressOptionContent}>
                        <div className={styles.addressOptionName}>
                          <FaMapMarkerAlt aria-hidden="true" />
                          <span>{addressOption.name?.trim() || 'Company Address'}</span>
                        </div>
                        <p className={styles.addressOptionValue}>{addressOption.address}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className={styles.addressSelectionActions}>
              <button
                type="button"
                className={styles.addressSelectionCancelButton}
                onClick={() => {
                  setIsOngoingAddressModalOpen(false)
                  setSelectedOngoingAddressId('')
                }}
                disabled={isUpdatingStatus}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.addressSelectionConfirmButton}
                onClick={handleConfirmOngoingAddress}
                disabled={isUpdatingStatus || !selectedOngoingAddress}
              >
                Set Ongoing
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(confirmationDialogContent)}
        title={confirmationDialogContent?.title || ''}
        message={confirmationDialogContent?.message || ''}
        confirmLabel={confirmationDialogContent?.confirmLabel || 'Confirm'}
        confirmTone={confirmationDialogContent?.confirmTone || 'danger'}
        cancelLabel={confirmationDialogContent?.cancelLabel || 'Cancel'}
        ariaLabel={confirmationDialogContent?.ariaLabel || 'Confirmation dialog'}
        isBusy={isUpdatingStatus}
        onCancel={() => {
          setPendingConfirmationAction(null)
        }}
        onConfirm={handleConfirmationAction}
      />
    </MainLayout>
  )
}

export default EmergencySosListPage
