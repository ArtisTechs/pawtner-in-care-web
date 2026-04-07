import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaFilter, FaSyncAlt, FaTimes, FaTrash } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
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
import { getErrorMessage } from '@/shared/api/api-error'
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
const DEFAULT_STATUS_OPTIONS: ReadonlyArray<EmergencySosStatus> = ['REQUESTED', 'ONGOING_RESCUE', 'RESCUED']

type EmergencySosRow = {
  addressLocation: string
  additionalLocationMessage: string
  createdAt?: string | null
  createdAtLabel: string
  dateKey: string
  description: string
  item: EmergencySos
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
  ONGOING_RESCUE: {
    badgeClassName: 'statusProcessing',
    label: 'Ongoing Rescue',
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

const toReporterName = (item: EmergencySos) => {
  const person = item.personFilled
  if (person) {
    const fullName = [person.firstName, person.middleName, person.lastName]
      .map((namePart) => namePart?.trim() || '')
      .filter(Boolean)
      .join(' ')

    if (fullName) {
      return fullName
    }

    const email = person.email?.trim()
    if (email) {
      return email
    }
  }

  return item.personFilledEmail?.trim() || 'Unknown Reporter'
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
  const status = (item.status as EmergencySosStatus) ?? 'REQUESTED'
  const type = (item.type as EmergencySosType) ?? 'INJURED'

  return {
    additionalLocationMessage: item.additionalLocationMessage?.trim() || '',
    addressLocation: item.addressLocation?.trim() || 'N/A',
    createdAt,
    createdAtLabel: formatDateLabel(createdAt),
    dateKey: toDateKey(createdAt),
    description: item.description?.trim() || '',
    item,
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
          ? (Array.from(new Set(fetchedStatuses)) as EmergencySosStatus[])
          : [...DEFAULT_STATUS_OPTIONS],
      )
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingLogs(false)
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

  const closeModal = () => {
    if (isUpdatingStatus) {
      return
    }

    setSelectedSosForAction(null)
    setPendingConfirmationAction(null)
  }

  const buildUpdatePayload = (
    selected: EmergencySosRow,
    status: EmergencySosStatus,
  ): UpdateEmergencySosPayload | null => {
    const source = selected.item
    const personFilledId = selected.personFilledId || source.personFilledId?.trim() || source.personFilled?.id?.trim() || ''
    const addressLocation = source.addressLocation?.trim() || selected.addressLocation
    const type = (source.type as EmergencySosType) ?? selected.type
    const latitude = source.latitude
    const longitude = source.long

    if (!personFilledId || !addressLocation || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return null
    }

    return {
      additionalLocationMessage: source.additionalLocationMessage?.trim() || undefined,
      addressLocation,
      description: source.description?.trim() || undefined,
      latitude,
      long: longitude,
      personFilledId,
      status,
      type,
    }
  }

  const handleUpdateStatus = (status: EmergencySosStatus) => {
    if (!selectedSosForAction) {
      return
    }

    if (!accessToken) {
      showToast('You need to sign in before updating an SOS request.', { variant: 'error' })
      return
    }

    if (selectedSosForAction.status === status) {
      showToast('Selected SOS request already has this status.', { variant: 'error' })
      return
    }

    const payload = buildUpdatePayload(selectedSosForAction, status)
    if (!payload) {
      showToast('Missing required SOS fields for update. Please refresh and try again.', { variant: 'error' })
      return
    }

    const updateRequestStatus = async () => {
      setIsUpdatingStatus(true)

      try {
        await emergencySosService.update(selectedSosForAction.reportId, payload, accessToken)
        setSelectedSosForAction(null)
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

    handleUpdateStatus(pendingConfirmationAction.status)
    setPendingConfirmationAction(null)
  }

  const canSetRequested = selectedSosForAction?.status !== 'REQUESTED'
  const canSetOngoing = selectedSosForAction?.status !== 'ONGOING_RESCUE'
  const canSetRescued = selectedSosForAction?.status !== 'RESCUED'

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
                    <th scope="col">ID</th>
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
                          <td>{row.reportId}</td>
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
                  <span className={styles.modalMetaLabel}>SOS ID</span>
                  <span className={styles.modalMetaValue}>{selectedSosForAction.reportId}</span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Reporter</span>
                  <span className={styles.modalMetaValue}>{selectedSosForAction.reporterName}</span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Type</span>
                  <span className={styles.modalMetaValue}>{selectedSosForAction.typeLabel}</span>
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
                <div className={styles.modalIconActions}>
                  <button
                    type="button"
                    className={`${styles.modalIconButton} ${styles.modalTextButton} ${styles.modalCancelRequestButton}`}
                    onClick={() => {
                      setPendingConfirmationAction({ kind: 'update-status', status: 'REQUESTED' })
                    }}
                    disabled={isUpdatingStatus || !canSetRequested}
                    aria-label="Set emergency SOS to requested"
                    title="Set to Requested"
                  >
                    <span className={styles.modalIconLabel}>Requested</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.modalIconButton} ${styles.modalTextButton} ${styles.modalRejectButton}`}
                    onClick={() => {
                      setPendingConfirmationAction({ kind: 'update-status', status: 'ONGOING_RESCUE' })
                    }}
                    disabled={isUpdatingStatus || !canSetOngoing}
                    aria-label="Set emergency SOS to ongoing rescue"
                    title="Set to Ongoing Rescue"
                  >
                    <span className={styles.modalIconLabel}>Ongoing</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.modalIconButton} ${styles.modalTextButton} ${styles.modalApproveButton}`}
                    onClick={() => {
                      setPendingConfirmationAction({ kind: 'update-status', status: 'RESCUED' })
                    }}
                    disabled={isUpdatingStatus || !canSetRescued}
                    aria-label="Set emergency SOS to rescued"
                    title="Set to Rescued"
                  >
                    <span className={styles.modalIconLabel}>Rescued</span>
                  </button>

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
                </div>
              </div>
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
