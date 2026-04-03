import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FaChevronLeft, FaChevronRight, FaFilter, FaPlus, FaSyncAlt, FaTimes } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { donationTransactionService } from '@/features/donation-transactions/services/donation-transaction.service'
import type {
  DonationTransaction,
  DonationTransactionPayload,
} from '@/features/donation-transactions/types/donation-transaction-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import DateMultiSelectPicker from '@/shared/components/ui/DateMultiSelectPicker/DateMultiSelectPicker'
import ConfirmModal from '@/shared/components/ui/ConfirmModal/ConfirmModal'
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

type DonationTransactionForm = {
  donatedAmount: string
  donationCampaignId: string
  message: string
  paymentModeId: string
  photoProof: string
  userId: string
}

type FormErrorKey = 'userId' | 'paymentModeId' | 'donationCampaignId' | 'photoProof' | 'donatedAmount'
type FormErrors = Record<FormErrorKey, string>

const createDefaultDonationTransactionForm = (): DonationTransactionForm => ({
  donatedAmount: '',
  donationCampaignId: '',
  message: '',
  paymentModeId: '',
  photoProof: '',
  userId: '',
})

const createEmptyFormErrors = (): FormErrors => ({
  donatedAmount: '',
  donationCampaignId: '',
  paymentModeId: '',
  photoProof: '',
  userId: '',
})

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
  const firstName = normalizeText(transaction.user?.firstName)
  const middleName = normalizeText(transaction.user?.middleName)
  const lastName = normalizeText(transaction.user?.lastName)
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ')

  if (fullName) {
    return fullName
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
  const createdAt = transaction.createdAt ?? transaction.updatedAt
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
    transactionId: transaction.id,
    userId,
  }
}

const mapRowToForm = (row: DonationLogRow): DonationTransactionForm => ({
  donatedAmount: row.donatedAmount > 0 ? String(row.donatedAmount) : '',
  donationCampaignId: row.campaignId,
  message: row.message,
  paymentModeId: row.paymentModeId,
  photoProof: row.photoProof,
  userId: row.userId,
})

const buildPayloadFromForm = (form: DonationTransactionForm): DonationTransactionPayload | null => {
  const donatedAmount = Number.parseFloat(form.donatedAmount.trim())
  if (!Number.isFinite(donatedAmount) || donatedAmount <= 0) {
    return null
  }

  return {
    donatedAmount,
    donationCampaignId: form.donationCampaignId.trim(),
    message: form.message.trim() || undefined,
    paymentModeId: form.paymentModeId.trim(),
    photoProof: form.photoProof.trim(),
    userId: form.userId.trim(),
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
  const [isSavingTransaction, setIsSavingTransaction] = useState(false)
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false)
  const [rows, setRows] = useState<DonationLogRow[]>([])
  const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([])
  const [selectedPaymentModeValues, setSelectedPaymentModeValues] = useState<string[]>([])
  const [selectedCampaignValues, setSelectedCampaignValues] = useState<string[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<DonationLogRow | null>(null)
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)
  const [transactionForm, setTransactionForm] = useState<DonationTransactionForm>(
    createDefaultDonationTransactionForm,
  )
  const [formErrors, setFormErrors] = useState<FormErrors>(createEmptyFormErrors)
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<DonationLogRow | null>(null)
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
    if (isSavingTransaction || isDeletingTransaction) {
      return
    }

    setIsTransactionModalOpen(false)
    setSelectedTransaction(null)
    setTransactionForm(createDefaultDonationTransactionForm())
    setFormErrors(createEmptyFormErrors())
  }, [isDeletingTransaction, isSavingTransaction])

  const openCreateModal = () => {
    setSelectedTransaction(null)
    setTransactionForm(createDefaultDonationTransactionForm())
    setFormErrors(createEmptyFormErrors())
    setIsTransactionModalOpen(true)
  }

  const openEditModal = (row: DonationLogRow) => {
    setSelectedTransaction(row)
    setTransactionForm(mapRowToForm(row))
    setFormErrors(createEmptyFormErrors())
    setIsTransactionModalOpen(true)
  }

  const clearFormError = useCallback((field: FormErrorKey) => {
    setFormErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors
      }

      return {
        ...currentErrors,
        [field]: '',
      }
    })
  }, [])

  const handleTransactionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before managing donation transactions.', { variant: 'error' })
      return
    }

    const persistTransaction = async () => {
      const nextErrors: FormErrors = {
        donatedAmount: transactionForm.donatedAmount.trim() ? '' : 'Donated amount is required.',
        donationCampaignId: transactionForm.donationCampaignId.trim() ? '' : 'Donation campaign ID is required.',
        paymentModeId: transactionForm.paymentModeId.trim() ? '' : 'Payment mode ID is required.',
        photoProof: transactionForm.photoProof.trim() ? '' : 'Photo proof URL is required.',
        userId: transactionForm.userId.trim() ? '' : 'User ID is required.',
      }

      const donatedAmount = Number.parseFloat(transactionForm.donatedAmount.trim())
      if (!Number.isFinite(donatedAmount) || donatedAmount <= 0) {
        nextErrors.donatedAmount = 'Donated amount must be a number greater than 0.'
      }

      if (Object.values(nextErrors).some(Boolean)) {
        setFormErrors(nextErrors)
        showToast('Please complete all required fields.', { variant: 'error' })
        return
      }

      const payload = buildPayloadFromForm(transactionForm)
      if (!payload) {
        setFormErrors((currentErrors) => ({
          ...currentErrors,
          donatedAmount: 'Donated amount must be a number greater than 0.',
        }))
        showToast('Please enter a valid donated amount.', { variant: 'error' })
        return
      }

      setIsSavingTransaction(true)

      try {
        if (selectedTransaction) {
          await donationTransactionService.update(selectedTransaction.transactionId, payload, accessToken)
          showToast('Donation transaction updated successfully.', { variant: 'success' })
        } else {
          await donationTransactionService.create(payload, accessToken)
          showToast('Donation transaction created successfully.', { variant: 'success' })
        }

        closeTransactionModal()
        await loadDonationLogs()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsSavingTransaction(false)
      }
    }

    void persistTransaction()
  }

  const handleDeleteTransactionConfirm = () => {
    if (!pendingDeleteTransaction) {
      return
    }

    if (!accessToken) {
      showToast('You need to sign in before deleting donation transactions.', { variant: 'error' })
      return
    }

    const transactionToDelete = pendingDeleteTransaction

    const deleteTransaction = async () => {
      setIsDeletingTransaction(true)

      try {
        await donationTransactionService.delete(transactionToDelete.transactionId, accessToken)
        setPendingDeleteTransaction(null)
        if (selectedTransaction?.transactionId === transactionToDelete.transactionId) {
          setIsTransactionModalOpen(false)
          setSelectedTransaction(null)
        }
        showToast('Donation transaction deleted successfully.', { variant: 'success' })
        await loadDonationLogs()
      } catch (error) {
        showToast(getErrorMessage(error), { variant: 'error' })
      } finally {
        setIsDeletingTransaction(false)
      }
    }

    void deleteTransaction()
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
            <button type="button" className={styles.addButton} onClick={openCreateModal}>
              <FaPlus className={styles.addButtonIcon} aria-hidden="true" />
              <span>Add Donation</span>
            </button>
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
                          openEditModal(row)
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
                {selectedTransaction ? 'Edit Donation Transaction' : 'Add Donation Transaction'}
              </h2>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => {
                  closeTransactionModal()
                }}
                aria-label="Close donation transaction modal"
                disabled={isSavingTransaction || isDeletingTransaction}
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className={styles.modalForm} onSubmit={handleTransactionSubmit} noValidate>
              <div className={styles.modalFields}>
                {selectedTransaction ? (
                  <>
                    <div className={styles.modalMeta}>
                      <span className={styles.modalMetaLabel}>Transaction ID</span>
                      <span className={styles.modalMetaValue}>{selectedTransaction.transactionId}</span>
                    </div>

                    <div className={styles.modalMeta}>
                      <span className={styles.modalMetaLabel}>Created Date</span>
                      <span className={styles.modalMetaValue}>{selectedTransaction.createdAtLabel}</span>
                    </div>
                  </>
                ) : null}

                <label className={styles.fieldLabel}>
                  <span>User ID</span>
                  <input
                    type="text"
                    value={transactionForm.userId}
                    onChange={(event) => {
                      clearFormError('userId')
                      setTransactionForm((currentForm) => ({
                        ...currentForm,
                        userId: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${formErrors.userId ? ` ${styles.fieldInputError}` : ''}`}
                    placeholder="Enter user UUID"
                  />
                  {formErrors.userId ? <span className={styles.fieldErrorText}>{formErrors.userId}</span> : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Payment Mode ID</span>
                  <input
                    type="text"
                    value={transactionForm.paymentModeId}
                    onChange={(event) => {
                      clearFormError('paymentModeId')
                      setTransactionForm((currentForm) => ({
                        ...currentForm,
                        paymentModeId: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${formErrors.paymentModeId ? ` ${styles.fieldInputError}` : ''}`}
                    placeholder="Enter payment mode UUID"
                  />
                  {formErrors.paymentModeId ? (
                    <span className={styles.fieldErrorText}>{formErrors.paymentModeId}</span>
                  ) : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Donation Campaign ID</span>
                  <input
                    type="text"
                    value={transactionForm.donationCampaignId}
                    onChange={(event) => {
                      clearFormError('donationCampaignId')
                      setTransactionForm((currentForm) => ({
                        ...currentForm,
                        donationCampaignId: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${formErrors.donationCampaignId ? ` ${styles.fieldInputError}` : ''}`}
                    placeholder="Enter donation campaign UUID"
                  />
                  {formErrors.donationCampaignId ? (
                    <span className={styles.fieldErrorText}>{formErrors.donationCampaignId}</span>
                  ) : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Photo Proof URL</span>
                  <input
                    type="url"
                    value={transactionForm.photoProof}
                    onChange={(event) => {
                      clearFormError('photoProof')
                      setTransactionForm((currentForm) => ({
                        ...currentForm,
                        photoProof: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${formErrors.photoProof ? ` ${styles.fieldInputError}` : ''}`}
                    placeholder="https://example.com/proofs/donation-proof.png"
                  />
                  {formErrors.photoProof ? (
                    <span className={styles.fieldErrorText}>{formErrors.photoProof}</span>
                  ) : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Donated Amount (PHP)</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={transactionForm.donatedAmount}
                    onChange={(event) => {
                      clearFormError('donatedAmount')
                      setTransactionForm((currentForm) => ({
                        ...currentForm,
                        donatedAmount: event.target.value,
                      }))
                    }}
                    className={`${styles.fieldInput}${formErrors.donatedAmount ? ` ${styles.fieldInputError}` : ''}`}
                    placeholder="e.g. 1500.00"
                  />
                  {formErrors.donatedAmount ? (
                    <span className={styles.fieldErrorText}>{formErrors.donatedAmount}</span>
                  ) : null}
                </label>

                <label className={styles.fieldLabel}>
                  <span>Message (Optional)</span>
                  <textarea
                    value={transactionForm.message}
                    onChange={(event) => {
                      setTransactionForm((currentForm) => ({
                        ...currentForm,
                        message: event.target.value,
                      }))
                    }}
                    className={styles.fieldTextarea}
                    rows={4}
                    maxLength={1000}
                    placeholder="Enter optional donation message."
                  />
                </label>
              </div>

              <div className={styles.modalActions}>
                <div className={styles.modalButtonRow}>
                  <button
                    type="button"
                    className={styles.modalCancelButton}
                    onClick={() => {
                      closeTransactionModal()
                    }}
                    disabled={isSavingTransaction || isDeletingTransaction}
                  >
                    Cancel
                  </button>

                  {selectedTransaction ? (
                    <button
                      type="button"
                      className={styles.modalDeleteButton}
                      onClick={() => {
                        setPendingDeleteTransaction(selectedTransaction)
                      }}
                      disabled={isSavingTransaction || isDeletingTransaction}
                    >
                      Delete
                    </button>
                  ) : null}

                  <button
                    type="submit"
                    className={styles.modalSubmitButton}
                    disabled={isSavingTransaction || isDeletingTransaction}
                  >
                    {isSavingTransaction
                      ? 'Saving...'
                      : selectedTransaction
                        ? 'Save Changes'
                        : 'Add Donation'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(pendingDeleteTransaction)}
        title="Delete donation transaction?"
        message={`Are you sure you want to delete transaction ${pendingDeleteTransaction?.transactionId ?? ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        ariaLabel="Delete donation transaction confirmation"
        isBusy={isDeletingTransaction}
        onCancel={() => {
          if (isDeletingTransaction) {
            return
          }
          setPendingDeleteTransaction(null)
        }}
        onConfirm={handleDeleteTransactionConfirm}
      />
    </MainLayout>
  )
}

export default DonationTransactionListPage
