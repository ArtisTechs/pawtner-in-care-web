import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { FaCheck, FaChevronLeft, FaChevronRight, FaFilter, FaSyncAlt, FaTimes, FaTrash } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { giftLogService } from '@/features/gift-logs/services/gift-log.service'
import type { GiftLog, GiftLogDeliveryType, GiftLogStatus } from '@/features/gift-logs/types/gift-log-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
import DateMultiSelectPicker from '@/shared/components/ui/DateMultiSelectPicker/DateMultiSelectPicker'
import PillMultiSelectDropdown from '@/shared/components/ui/PillMultiSelectDropdown/PillMultiSelectDropdown'
import StatusBadge, { type StatusBadgeTone } from '@/shared/components/ui/StatusBadge/StatusBadge'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './GiftLogListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'gift-logs'
const DEFAULT_DELIVERY_TYPE_OPTIONS: ReadonlyArray<GiftLogDeliveryType> = ['PERSONAL', 'SHIPPING']
const DEFAULT_STATUS_OPTIONS: ReadonlyArray<GiftLogStatus> = ['PENDING', 'DELIVERED']
const LIST_PAGE_SIZE = 20

type GiftLogRow = {
  createdAt?: string | null
  createdAtLabel: string
  customItemName: string
  dateKey: string
  deliveryType: GiftLogDeliveryType
  deliveryTypeLabel: string
  giftId: string
  isCustomGiftBox: boolean
  itemLabel: string
  itemListingId: string
  message: string
  photo: string
  quantity: number
  shippingCode: string
  shippingCompanyName: string
  sortTime: number
  status: GiftLogStatus
  statusLabel: string
}

type PendingConfirmationAction =
  | {
      kind: 'delete-log'
    }
  | {
      kind: 'update-status'
      status: GiftLogStatus
    }

const areDateSelectionsEqual = (leftValues: string[], rightValues: string[]) => {
  if (leftValues.length !== rightValues.length) {
    return false
  }

  return leftValues.every((leftValue, index) => leftValue === rightValues[index])
}

const STATUS_UI: Record<
  string,
  {
    tone: StatusBadgeTone
    label: string
  }
> = {
  CANCELLED: {
    tone: 'warning',
    label: 'Cancelled',
  },
  DELIVERED: {
    tone: 'positive',
    label: 'Delivered',
  },
  PENDING: {
    tone: 'info',
    label: 'Pending',
  },
  REJECTED: {
    tone: 'danger',
    label: 'Rejected',
  },
}

const DELIVERY_TYPE_LABELS: Record<string, string> = {
  PERSONAL: 'Personal',
  SHIPPING: 'Shipping',
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

const toNormalizedText = (value?: string | null) => value?.trim() || ''

const toBoolean = (value?: boolean | string | null) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true'
  }

  return false
}

const toQuantity = (value?: number | string | null) => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    return Math.floor(value)
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed >= 1) {
      return parsed
    }
  }

  return 1
}

const toReadableLabel = (value?: string | null) => {
  const normalized = value?.trim()
  if (!normalized) {
    return 'Unknown'
  }

  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

const normalizeEnumValue = (value?: string | null, fallbackValue = '') => {
  const normalized = value?.trim().toUpperCase()
  return normalized || fallbackValue
}

const toDeliveryTypeLabel = (deliveryType?: string | null) => {
  const normalized = normalizeEnumValue(deliveryType)
  return DELIVERY_TYPE_LABELS[normalized] ?? toReadableLabel(normalized)
}

const toPreviewPhoto = (giftLog: GiftLog) => {
  const itemPhoto = toNormalizedText(giftLog.itemListing?.photo)
  if (itemPhoto) {
    return itemPhoto
  }

  return toNormalizedText(giftLog.photo)
}

const resolveStatusUi = (status: GiftLogStatus) => {
  const normalizedStatus = normalizeEnumValue(status)
  return STATUS_UI[normalizedStatus] ?? { tone: 'neutral', label: toReadableLabel(normalizedStatus) }
}

const toItemLabel = (giftLog: GiftLog) => {
  const customItemName = toNormalizedText(giftLog.customItemName)
  const itemSelected = toNormalizedText(giftLog.itemSelected)
  const listedItemName = toNormalizedText(giftLog.itemListing?.itemName)
  const itemListingId = toNormalizedText(giftLog.itemListingId)
  const hasItemReference = Boolean(customItemName || itemSelected || listedItemName || itemListingId)

  if (!hasItemReference && toBoolean(giftLog.isCustomGiftBox)) {
    return 'Custom Box'
  }

  if (customItemName) {
    return customItemName
  }

  if (itemSelected) {
    return itemSelected
  }

  if (listedItemName) {
    return listedItemName
  }

  if (itemListingId) {
    return itemListingId
  }

  return 'Unknown Item'
}

const mapGiftLogRow = (giftLog: GiftLog): GiftLogRow => {
  const createdAt = giftLog.createdDate ?? giftLog.createdAt ?? giftLog.updatedDate ?? giftLog.updatedAt
  const deliveryType = normalizeEnumValue(giftLog.deliveryType, 'PERSONAL') as GiftLogDeliveryType
  const status = normalizeEnumValue(giftLog.status, 'PENDING') as GiftLogStatus

  return {
    createdAt,
    createdAtLabel: formatDateLabel(createdAt),
    customItemName: toNormalizedText(giftLog.customItemName),
    dateKey: toDateKey(createdAt),
    deliveryType,
    deliveryTypeLabel: toDeliveryTypeLabel(deliveryType),
    giftId: toNormalizedText(giftLog.id),
    isCustomGiftBox: toBoolean(giftLog.isCustomGiftBox),
    itemLabel: toItemLabel(giftLog),
    itemListingId: toNormalizedText(giftLog.itemListingId) || toNormalizedText(giftLog.itemListing?.id),
    message: toNormalizedText(giftLog.message),
    photo: toPreviewPhoto(giftLog),
    quantity: toQuantity(giftLog.quantity),
    shippingCode: toNormalizedText(giftLog.shippingCode),
    shippingCompanyName: toNormalizedText(giftLog.shippingCompanyName),
    sortTime: toSortTime(createdAt),
    status,
    statusLabel: resolveStatusUi(status).label,
  }
}

interface GiftLogListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function GiftLogListPage({ onLogout, session }: GiftLogListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [rows, setRows] = useState<GiftLogRow[]>([])
  const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([])
  const [selectedDeliveryTypeValues, setSelectedDeliveryTypeValues] = useState<GiftLogDeliveryType[]>([])
  const [selectedStatusValues, setSelectedStatusValues] = useState<GiftLogStatus[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMoreRows, setHasMoreRows] = useState(false)
  const [isLoadingMoreRows, setIsLoadingMoreRows] = useState(false)
  const [selectedGiftForAction, setSelectedGiftForAction] = useState<GiftLogRow | null>(null)
  const [pendingConfirmationAction, setPendingConfirmationAction] = useState<PendingConfirmationAction | null>(null)
  const [deliveryTypeOptions, setDeliveryTypeOptions] = useState<GiftLogDeliveryType[]>([
    ...DEFAULT_DELIVERY_TYPE_OPTIONS,
  ])
  const [statusOptions, setStatusOptions] = useState<GiftLogStatus[]>([...DEFAULT_STATUS_OPTIONS])
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const lastAutoLoadedTokenRef = useRef<string | null>(null)
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''

  const isLoadingMoreRowsRef = useRef(false)
  const canTriggerLoadMoreRef = useRef(true)

  const loadGiftLogs = useCallback(async (options?: { append?: boolean; page?: number }) => {
    if (!accessToken) {
      setRows([])
      setDeliveryTypeOptions([...DEFAULT_DELIVERY_TYPE_OPTIONS])
      setStatusOptions([...DEFAULT_STATUS_OPTIONS])
      setCurrentPage(0)
      setHasMoreRows(false)
      return
    }

    const shouldAppend = Boolean(options?.append)
    const targetPage = Math.max(0, options?.page ?? 0)

    if (shouldAppend) {
      setIsLoadingMoreRows(true)
    } else {
      setIsLoadingLogs(true)
    }

    try {
      const result = await giftLogService.list(accessToken, {
        page: targetPage,
        size: LIST_PAGE_SIZE,
        sortBy: 'createdDate',
        sortDir: 'desc',
      })
      const mappedRows = result.items.map(mapGiftLogRow)
      const sortedRows = [...mappedRows].sort((leftRow, rightRow) => rightRow.sortTime - leftRow.sortTime)
      setRows((currentRows) => {
        if (!shouldAppend) {
          return sortedRows
        }

        const rowMap = new Map(currentRows.map((row) => [row.giftId, row]))
        sortedRows.forEach((row) => {
          rowMap.set(row.giftId, row)
        })

        return Array.from(rowMap.values()).sort((leftRow, rightRow) => rightRow.sortTime - leftRow.sortTime)
      })
      setCurrentPage(result.page)
      setHasMoreRows(!result.isLast && result.page + 1 < result.totalPages)

      const nextDeliveryTypeOptions = Array.from(
        new Set([...DEFAULT_DELIVERY_TYPE_OPTIONS, ...sortedRows.map((row) => row.deliveryType)]),
      ) as GiftLogDeliveryType[]
      const nextStatusOptions = Array.from(
        new Set([...DEFAULT_STATUS_OPTIONS, ...sortedRows.map((row) => row.status)]),
      ) as GiftLogStatus[]

      setDeliveryTypeOptions(nextDeliveryTypeOptions)
      setStatusOptions(nextStatusOptions)
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      if (shouldAppend) {
        setIsLoadingMoreRows(false)
      } else {
        setIsLoadingLogs(false)
      }
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
    void loadGiftLogs()
  }, [accessToken, clearToast, loadGiftLogs])

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

      if (selectedDeliveryTypeValues.length > 0 && !selectedDeliveryTypeValues.includes(row.deliveryType)) {
        return false
      }

      if (selectedStatusValues.length > 0 && !selectedStatusValues.includes(row.status)) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return (
        row.giftId.toLowerCase().includes(normalizedSearch) ||
        row.itemLabel.toLowerCase().includes(normalizedSearch) ||
        row.deliveryType.toLowerCase().includes(normalizedSearch) ||
        row.deliveryTypeLabel.toLowerCase().includes(normalizedSearch) ||
        row.status.toLowerCase().includes(normalizedSearch) ||
        row.statusLabel.toLowerCase().includes(normalizedSearch) ||
        String(row.quantity).includes(normalizedSearch) ||
        row.shippingCompanyName.toLowerCase().includes(normalizedSearch) ||
        row.shippingCode.toLowerCase().includes(normalizedSearch) ||
        row.message.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [rows, searchValue, selectedDateKeys, selectedDeliveryTypeValues, selectedStatusValues])
  const handleTableScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMoreRows || isLoadingLogs || isLoadingMoreRows || isLoadingMoreRowsRef.current) {
      return
    }

    const scrollElement = event.currentTarget
    const distanceFromBottom =
      scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight

    if (distanceFromBottom > 180) {
      canTriggerLoadMoreRef.current = true
      return
    }

    if (distanceFromBottom <= 120 && canTriggerLoadMoreRef.current) {
      canTriggerLoadMoreRef.current = false
      isLoadingMoreRowsRef.current = true

      const loadMore = async () => {
        try {
          await loadGiftLogs({ append: true, page: currentPage + 1 })
        } finally {
          isLoadingMoreRowsRef.current = false
        }
      }

      void loadMore()
    }
  }

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
    setSelectedDeliveryTypeValues([])
    setSelectedStatusValues([])
    const resetDateKeys = dateOptions[0] ? [dateOptions[0].value] : []
    applyDateSelection(resetDateKeys)
  }

  const closeModal = () => {
    if (isUpdatingStatus) {
      return
    }

    setSelectedGiftForAction(null)
    setPendingConfirmationAction(null)
  }

  const handleUpdateStatus = (status: GiftLogStatus) => {
    if (!selectedGiftForAction) {
      return
    }

    if (!accessToken) {
      showToast('You need to sign in before updating a gift log.', { variant: 'error' })
      return
    }

    if (selectedGiftForAction.status === status) {
      showToast('Selected gift log already has this status.', { variant: 'error' })
      return
    }

    const updateGiftStatus = async () => {
      setIsUpdatingStatus(true)

      try {
        await giftLogService.updateStatus(selectedGiftForAction.giftId, status, accessToken)
        setSelectedGiftForAction(null)
        showToast('Gift log status updated successfully.', { variant: 'success' })
        await loadGiftLogs()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsUpdatingStatus(false)
      }
    }

    void updateGiftStatus()
  }

  const handleDeleteLog = () => {
    if (!selectedGiftForAction || !accessToken) {
      return
    }

    const deleteGiftLog = async () => {
      setIsUpdatingStatus(true)

      try {
        await giftLogService.delete(selectedGiftForAction.giftId, accessToken)
        setSelectedGiftForAction(null)
        showToast('Gift log deleted successfully.', { variant: 'success' })
        await loadGiftLogs()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsUpdatingStatus(false)
      }
    }

    void deleteGiftLog()
  }

  const getConfirmationDialogContent = useCallback(() => {
    if (!pendingConfirmationAction || !selectedGiftForAction) {
      return null
    }

    if (pendingConfirmationAction.kind === 'delete-log') {
      return {
        ariaLabel: 'Delete gift log confirmation',
        cancelLabel: 'Cancel',
        confirmLabel: 'Delete',
        confirmTone: 'danger' as const,
        message: `Delete gift log ${selectedGiftForAction.giftId}? This cannot be undone.`,
        title: 'Delete gift log?',
      }
    }

    const statusLabel = toReadableLabel(pendingConfirmationAction.status).toLowerCase()
    return {
      ariaLabel: `Confirm ${statusLabel} gift log status`,
      cancelLabel: 'No',
      confirmLabel: 'Yes',
      confirmTone: pendingConfirmationAction.status === 'DELIVERED' ? ('success' as const) : ('danger' as const),
      message: `Are you sure you want to set this gift log to ${statusLabel}?`,
      title: `Confirm ${statusLabel}`,
    }
  }, [pendingConfirmationAction, selectedGiftForAction])

  const confirmationDialogContent = getConfirmationDialogContent()

  const handleConfirmationAction = () => {
    if (!pendingConfirmationAction) {
      return
    }

    if (pendingConfirmationAction.kind === 'delete-log') {
      handleDeleteLog()
      setPendingConfirmationAction(null)
      return
    }

    handleUpdateStatus(pendingConfirmationAction.status)
    setPendingConfirmationAction(null)
  }

  const canSetDelivered = selectedGiftForAction?.status !== 'DELIVERED'

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
          <h1 className={styles.pageTitle}>Gift Logs</h1>

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
                options={deliveryTypeOptions.map((deliveryTypeOption) => ({
                  label: toDeliveryTypeLabel(deliveryTypeOption),
                  value: deliveryTypeOption,
                }))}
                selectedValues={selectedDeliveryTypeValues}
                placeholder="Delivery Type"
                panelTitle="Select Delivery Type"
                helperText="*You can choose multiple delivery types"
                onApply={(values) => {
                  setSelectedDeliveryTypeValues(values as GiftLogDeliveryType[])
                }}
              />
            </label>

            <label className={styles.filterCell}>
              <PillMultiSelectDropdown
                options={statusOptions.map((statusOption) => ({
                  label: toReadableLabel(statusOption),
                  value: statusOption,
                }))}
                selectedValues={selectedStatusValues}
                placeholder="Gift Status"
                panelTitle="Select Gift Status"
                helperText="*You can choose multiple statuses"
                panelAlign="right"
                onApply={(values) => {
                  setSelectedStatusValues(values as GiftLogStatus[])
                }}
              />
            </label>

            <button type="button" className={styles.resetButton} onClick={handleResetFilters}>
              <FaSyncAlt aria-hidden="true" />
              <span>Reset Filter</span>
            </button>
          </div>

          <div className={styles.tablePanel}>
            <div className={styles.tableScroll} onScroll={handleTableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Delivery</th>
                    <th scope="col">Date</th>
                    <th scope="col">Shipping</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingLogs ? (
                    Array.from({ length: 8 }, (_, rowIndex) => (
                      <tr key={`gift-log-skeleton-${rowIndex}`} aria-hidden="true">
                        <td colSpan={6}>
                          <div className={styles.rowSkeleton} />
                        </td>
                      </tr>
                    ))
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyStateCell}>
                        No gift logs found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const statusUi = resolveStatusUi(row.status)

                      return (
                        <tr
                          key={row.giftId}
                          className={styles.clickableRow}
                          onClick={() => {
                            setSelectedGiftForAction(row)
                          }}
                        >
                          <td>{row.itemLabel}</td>
                          <td>{row.quantity}</td>
                          <td>{row.deliveryTypeLabel}</td>
                          <td>{row.createdAtLabel}</td>
                          <td>{row.deliveryType === 'SHIPPING' ? row.shippingCompanyName || row.shippingCode || 'N/A' : 'Personal Delivery'}</td>
                          <td>
                            <StatusBadge label={statusUi.label} tone={statusUi.tone} />
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

      {selectedGiftForAction ? (
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
            aria-labelledby="gift-log-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="gift-log-modal-title" className={styles.modalTitle}>
                Update Gift Log
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeModal()
                }}
                aria-label="Close gift log modal"
                disabled={isUpdatingStatus}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.modalForm}>
              <div className={styles.modalFields}>
                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Item</span>
                  <span className={styles.modalMetaValue}>{selectedGiftForAction.itemLabel}</span>
                </div>

                {selectedGiftForAction.isCustomGiftBox ? (
                  <div className={styles.modalMeta}>
                    <span className={styles.modalMetaLabel}>Gift Type</span>
                    <span className={styles.modalMetaValue}>Custom Box</span>
                  </div>
                ) : null}

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Quantity</span>
                  <span className={styles.modalMetaValue}>{selectedGiftForAction.quantity}</span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Date</span>
                  <span className={styles.modalMetaValue}>{selectedGiftForAction.createdAtLabel}</span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Delivery Type</span>
                  <span className={styles.modalMetaValue}>{selectedGiftForAction.deliveryTypeLabel}</span>
                </div>

                {selectedGiftForAction.deliveryType === 'SHIPPING' ? (
                  <>
                    <div className={styles.modalMeta}>
                      <span className={styles.modalMetaLabel}>Shipping Company</span>
                      <span className={styles.modalMetaValue}>{selectedGiftForAction.shippingCompanyName || 'N/A'}</span>
                    </div>

                    <div className={styles.modalMeta}>
                      <span className={styles.modalMetaLabel}>Shipping Code</span>
                      <span className={styles.modalMetaValue}>{selectedGiftForAction.shippingCode || 'N/A'}</span>
                    </div>
                  </>
                ) : null}

                <div className={styles.fieldLabel}>
                  <span>Current Status</span>
                  <div className={styles.fieldDisplay}>
                    {selectedGiftForAction.status} ({selectedGiftForAction.statusLabel})
                  </div>
                </div>

                <div className={styles.fieldLabel}>
                  <span>Message</span>
                  <div className={styles.fieldTextView}>
                    {selectedGiftForAction.message || 'No message provided.'}
                  </div>
                </div>

                <div className={styles.modalMetaColumn}>
                  <span className={styles.modalMetaLabel}>Photo</span>
                  {selectedGiftForAction.photo ? (
                    <img
                      className={styles.photoPreview}
                      src={selectedGiftForAction.photo}
                      alt={selectedGiftForAction.itemLabel}
                      loading="lazy"
                    />
                  ) : (
                    <span className={styles.modalMetaText}>No photo provided.</span>
                  )}
                </div>
              </div>

              <div className={styles.modalActions}>
                <div className={styles.modalIconActions}>
                  <button
                    type="button"
                    className={`${styles.modalIconButton} ${styles.modalApproveButton}`}
                    onClick={() => {
                      setPendingConfirmationAction({ kind: 'update-status', status: 'DELIVERED' })
                    }}
                    disabled={isUpdatingStatus || !canSetDelivered}
                    aria-label="Set gift log as delivered"
                    title="Set to Delivered"
                  >
                    <FaCheck aria-hidden="true" />
                    <span className={styles.modalIconLabel}>Delivered</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.modalIconButton} ${styles.modalDeleteButton}`}
                    onClick={() => {
                      setPendingConfirmationAction({ kind: 'delete-log' })
                    }}
                    disabled={isUpdatingStatus}
                    aria-label="Delete gift log"
                    title="Delete Gift Log"
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

export default GiftLogListPage
