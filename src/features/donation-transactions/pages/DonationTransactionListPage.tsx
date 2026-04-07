import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaChevronLeft, FaChevronRight, FaFilter, FaSyncAlt, FaTimes } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { donationTransactionService } from '@/features/donation-transactions/services/donation-transaction.service'
import type { DonationTransaction } from '@/features/donation-transactions/types/donation-transaction-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import DateMultiSelectPicker from '@/shared/components/ui/DateMultiSelectPicker/DateMultiSelectPicker'
import PillMultiSelectDropdown from '@/shared/components/ui/PillMultiSelectDropdown/PillMultiSelectDropdown'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './DonationTransactionListPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'donation-logs'

type DonationLogRow = {
  amountLabel: string
  campaignId: string
  campaignLabel: string
  createdAt?: string | null
  createdAtLabel: string
  dateKey: string
  donatedAmount: number
  donorLabel: string
  message: string
  paymentModeId: string
  paymentModeLabel: string
  photoProof: string
  sortTime: number
  transactionId: string
  userId: string
}

const areDateSelectionsEqual = (leftValues: string[], rightValues: string[]) => {
  if (leftValues.length !== rightValues.length) {
    return false
  }

  return leftValues.every((leftValue, index) => leftValue === rightValues[index])
}

const normalizeText = (value?: string | null) => value?.trim() || ''

const parseAmount = (value?: number | string | null) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const parsedValue = Number.parseFloat(value)
    return Number.isFinite(parsedValue) ? parsedValue : 0
  }

  return 0
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-PH', {
    currency: 'PHP',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(value)
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

  const parsedValue = new Date(value).getTime()
  return Number.isNaN(parsedValue) ? 0 : parsedValue
}

const resolveDonorLabel = (transaction: DonationTransaction, fallbackUserId: string) => {
  const fullName = normalizeText(transaction.user?.fullName)
  if (fullName) {
    return fullName
  }

  const firstName = normalizeText(transaction.user?.firstName)
  const middleName = normalizeText(transaction.user?.middleName)
  const lastName = normalizeText(transaction.user?.lastName)
  const derivedName = [firstName, middleName, lastName].filter(Boolean).join(' ')

  if (derivedName) {
    return derivedName
  }

  const email = normalizeText(transaction.user?.email)
  if (email) {
    return email
  }

  return fallbackUserId || 'Unknown Donor'
}

const resolvePaymentModeLabel = (transaction: DonationTransaction, fallbackPaymentModeId: string) => {
  return (
    normalizeText(transaction.paymentMode?.name) ||
    normalizeText(transaction.paymentMode?.label) ||
    normalizeText(transaction.paymentMode?.mode) ||
    normalizeText(transaction.paymentMode?.accountNumber) ||
    fallbackPaymentModeId ||
    'Unknown Payment Mode'
  )
}

const resolveCampaignLabel = (transaction: DonationTransaction, fallbackCampaignId: string) => {
  return (
    normalizeText(transaction.donationCampaign?.title) ||
    normalizeText(transaction.donationCampaign?.name) ||
    fallbackCampaignId ||
    'Unknown Campaign'
  )
}

const mapDonationTransactionToRow = (transaction: DonationTransaction): DonationLogRow => {
  const userId = normalizeText(transaction.userId) || normalizeText(transaction.user?.id)
  const paymentModeId =
    normalizeText(transaction.paymentModeId) || normalizeText(transaction.paymentMode?.id)
  const campaignId =
    normalizeText(transaction.donationCampaignId) || normalizeText(transaction.donationCampaign?.id)
  const createdAt =
    transaction.createdDate ?? transaction.createdAt ?? transaction.updatedDate ?? transaction.updatedAt
  const donatedAmount = parseAmount(transaction.donatedAmount)

  return {
    amountLabel: formatCurrency(donatedAmount),
    campaignId,
    campaignLabel: resolveCampaignLabel(transaction, campaignId),
    createdAt,
    createdAtLabel: formatDateLabel(createdAt),
    dateKey: toDateKey(createdAt),
    donatedAmount,
    donorLabel: resolveDonorLabel(transaction, userId),
    message: normalizeText(transaction.message),
    paymentModeId,
    paymentModeLabel: resolvePaymentModeLabel(transaction, paymentModeId),
    photoProof: normalizeText(transaction.photoProof),
    sortTime: toSortTime(createdAt),
    transactionId: normalizeText(transaction.transactionId) || transaction.id,
    userId,
  }
}

interface DonationTransactionListPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function DonationTransactionListPage({ onLogout, session }: DonationTransactionListPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [rows, setRows] = useState<DonationLogRow[]>([])
  const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([])
  const [selectedPaymentModeValues, setSelectedPaymentModeValues] = useState<string[]>([])
  const [selectedCampaignValues, setSelectedCampaignValues] = useState<string[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<DonationLogRow | null>(null)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const lastAutoLoadedTokenRef = useRef<string | null>(null)
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''

  const loadDonationLogs = useCallback(async () => {
    if (!accessToken) {
      setRows([])
      return
    }

    setIsLoadingLogs(true)

    try {
      const transactions = await donationTransactionService.list(accessToken)
      const mappedRows = transactions.map(mapDonationTransactionToRow)
      const sortedRows = [...mappedRows].sort((leftRow, rightRow) => rightRow.sortTime - leftRow.sortTime)
      setRows(sortedRows)
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
    void loadDonationLogs()
  }, [accessToken, clearToast, loadDonationLogs])

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

  const paymentModeOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.paymentModeLabel))).sort((left, right) =>
      left.localeCompare(right),
    )
  }, [rows])

  const campaignOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.campaignLabel))).sort((left, right) =>
      left.localeCompare(right),
    )
  }, [rows])

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()

    return rows.filter((row) => {
      if (selectedDateKeys.length > 0 && !selectedDateKeys.includes(row.dateKey)) {
        return false
      }

      if (selectedPaymentModeValues.length > 0 && !selectedPaymentModeValues.includes(row.paymentModeLabel)) {
        return false
      }

      if (selectedCampaignValues.length > 0 && !selectedCampaignValues.includes(row.campaignLabel)) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return (
        row.transactionId.toLowerCase().includes(normalizedSearch) ||
        row.donorLabel.toLowerCase().includes(normalizedSearch) ||
        row.campaignLabel.toLowerCase().includes(normalizedSearch) ||
        row.paymentModeLabel.toLowerCase().includes(normalizedSearch) ||
        row.amountLabel.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [rows, searchValue, selectedDateKeys, selectedPaymentModeValues, selectedCampaignValues])

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
    setSelectedPaymentModeValues([])
    setSelectedCampaignValues([])
    const resetDateKeys = dateOptions[0] ? [dateOptions[0].value] : []
    applyDateSelection(resetDateKeys)
  }

  const closeTransactionModal = useCallback(() => {
    setIsTransactionModalOpen(false)
    setSelectedTransaction(null)
  }, [])

  const openViewModal = (row: DonationLogRow) => {
    setSelectedTransaction(row)
    setIsTransactionModalOpen(true)
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
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Donation Logs</h1>
          </div>

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
                options={paymentModeOptions.map((paymentModeOption) => ({
                  label: paymentModeOption,
                  value: paymentModeOption,
                }))}
                selectedValues={selectedPaymentModeValues}
                placeholder="Payment Mode"
                panelTitle="Select Payment Mode"
                helperText="*You can choose multiple payment modes"
                onApply={(values) => {
                  setSelectedPaymentModeValues(values)
                }}
              />
            </label>

            <label className={styles.filterCell}>
              <PillMultiSelectDropdown
                options={campaignOptions.map((campaignOption) => ({
                  label: campaignOption,
                  value: campaignOption,
                }))}
                selectedValues={selectedCampaignValues}
                placeholder="Campaign"
                panelTitle="Select Campaign"
                helperText="*You can choose multiple campaigns"
                panelAlign="right"
                onApply={(values) => {
                  setSelectedCampaignValues(values)
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
                    <th scope="col">Transaction ID</th>
                    <th scope="col">Donor</th>
                    <th scope="col">Campaign</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Date</th>
                    <th scope="col">Payment Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingLogs ? (
                    Array.from({ length: 8 }, (_, rowIndex) => (
                      <tr key={`donation-log-skeleton-${rowIndex}`} aria-hidden="true">
                        <td colSpan={6}>
                          <div className={styles.rowSkeleton} />
                        </td>
                      </tr>
                    ))
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyStateCell}>
                        No donation logs found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.transactionId}
                        className={styles.clickableRow}
                        onClick={() => {
                          openViewModal(row)
                        }}
                      >
                        <td>{row.transactionId}</td>
                        <td>{row.donorLabel}</td>
                        <td>{row.campaignLabel}</td>
                        <td className={styles.amountCell}>{row.amountLabel}</td>
                        <td>{row.createdAtLabel}</td>
                        <td>{row.paymentModeLabel}</td>
                      </tr>
                    ))
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

      {isTransactionModalOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeTransactionModal()
            }
          }}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="donation-transaction-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <h2 id="donation-transaction-modal-title" className={styles.modalTitle}>
                Donation Transaction Details
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeTransactionModal()
                }}
                aria-label="Close donation transaction modal"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className={styles.modalForm}>
              <div className={styles.modalFields}>
                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Donor</span>
                  <span className={styles.modalMetaValue}>{selectedTransaction?.donorLabel || 'N/A'}</span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Campaign</span>
                  <span className={styles.modalMetaValue}>{selectedTransaction?.campaignLabel || 'N/A'}</span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Donated Amount</span>
                  <span className={styles.modalMetaValue}>{selectedTransaction?.amountLabel || 'N/A'}</span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Date</span>
                  <span className={styles.modalMetaValue}>{selectedTransaction?.createdAtLabel || 'N/A'}</span>
                </div>

                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaLabel}>Payment Mode</span>
                  <span className={styles.modalMetaValue}>{selectedTransaction?.paymentModeLabel || 'N/A'}</span>
                </div>

                <div className={styles.modalMetaColumn}>
                  <span className={styles.modalMetaLabel}>Message</span>
                  <span className={styles.modalMetaText}>{selectedTransaction?.message || 'No message provided.'}</span>
                </div>

                <div className={styles.modalMetaColumn}>
                  <span className={styles.modalMetaLabel}>Photo Proof</span>
                  {selectedTransaction?.photoProof ? (
                    <img
                      className={styles.proofImage}
                      src={selectedTransaction.photoProof}
                      alt="Donation proof"
                      loading="lazy"
                    />
                  ) : (
                    <span className={styles.modalMetaText}>No photo proof provided.</span>
                  )}
                </div>
              </div>

              <div className={styles.modalActions}>
                <div className={styles.modalButtonRow}>
                  <button
                    type="button"
                    className={styles.modalCancelButton}
                    onClick={() => {
                      closeTransactionModal()
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  )
}

export default DonationTransactionListPage
