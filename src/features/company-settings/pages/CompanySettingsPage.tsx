import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { FaEdit, FaPlus, FaSave, FaTimes, FaTrashAlt } from 'react-icons/fa'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { getAuthSessionUserId } from '@/features/auth/utils/auth-utils'
import { companySettingsService } from '@/features/company-settings/services/company-settings.service'
import type { CompanySettings, CompanySettingsPayload } from '@/features/company-settings/types/company-settings-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { ApiError, getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import LocationPickerMap from '@/shared/components/maps/LocationPickerMap/LocationPickerMap'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import { isValidContactNumber, isValidEmail, normalizeContactNumber } from '@/shared/lib/validation/contact'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './CompanySettingsPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'settings'
const DEFAULT_CONTACT_NUMBER = ''
const DEFAULT_EMAIL_ADDRESS = ''
const DEFAULT_LINK_URL = ''
const DEFAULT_TOTAL_AVAILABLE_SPACE_FOR_PETS = ''
const DEFAULT_MAX_RESCUES_PER_DAY = ''
const HTTP_URL_PATTERN = /^https?:\/\/.+/i

type CompanyAddressForm = {
  address: string
  latitude: string
  long: string
  name: string
}

const createEmptyAddress = (): CompanyAddressForm => ({
  address: '',
  latitude: '',
  long: '',
  name: '',
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
  totalAvailableSpaceForPets: Number.isFinite(settings.totalAvailableSpaceForPets)
    ? String(settings.totalAvailableSpaceForPets)
    : DEFAULT_TOTAL_AVAILABLE_SPACE_FOR_PETS,
})

const parseCoordinate = (value: string) => Number.parseFloat(value.trim())
const parseWholeNumber = (value: string) => Number.parseInt(value.trim(), 10)
const isValidLongitude = (value: number) => value >= -180 && value <= 180
const isValidLatitude = (value: number) => value >= -90 && value <= 90

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
  const [totalAvailableSpaceForPets, setTotalAvailableSpaceForPets] = useState(DEFAULT_TOTAL_AVAILABLE_SPACE_FOR_PETS)
  const [maxRescuesPerDay, setMaxRescuesPerDay] = useState(DEFAULT_MAX_RESCUES_PER_DAY)
  const [addresses, setAddresses] = useState<CompanyAddressForm[]>([createEmptyAddress()])
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [settingsRecord, setSettingsRecord] = useState<CompanySettings | null>(null)
  const accessToken = session?.accessToken?.trim() ?? ''
  const userId = getAuthSessionUserId(session?.user)

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

  const loadCompanySettings = useCallback(async () => {
    if (!accessToken) {
      setContactNumber(DEFAULT_CONTACT_NUMBER)
      setEmailAddress(DEFAULT_EMAIL_ADDRESS)
      setLinkUrl(DEFAULT_LINK_URL)
      setTotalAvailableSpaceForPets(DEFAULT_TOTAL_AVAILABLE_SPACE_FOR_PETS)
      setMaxRescuesPerDay(DEFAULT_MAX_RESCUES_PER_DAY)
      setAddresses([createEmptyAddress()])
      setSettingsRecord(null)
      setIsEditMode(true)
      return
    }

    setIsLoadingSettings(true)

    try {
      const response = await companySettingsService.get(accessToken)
      const nextForm = mapSettingsToForm(response)
      setContactNumber(nextForm.contactNumber)
      setEmailAddress(nextForm.emailAddress)
      setLinkUrl(nextForm.linkUrl)
      setTotalAvailableSpaceForPets(nextForm.totalAvailableSpaceForPets)
      setMaxRescuesPerDay(nextForm.maxRescuesPerDay)
      setAddresses(nextForm.addresses.length > 0 ? nextForm.addresses : [createEmptyAddress()])
      setSettingsRecord(response)
      setIsEditMode(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setContactNumber(DEFAULT_CONTACT_NUMBER)
        setEmailAddress(DEFAULT_EMAIL_ADDRESS)
        setLinkUrl(DEFAULT_LINK_URL)
        setTotalAvailableSpaceForPets(DEFAULT_TOTAL_AVAILABLE_SPACE_FOR_PETS)
        setMaxRescuesPerDay(DEFAULT_MAX_RESCUES_PER_DAY)
        setAddresses([createEmptyAddress()])
        setSettingsRecord(null)
        setIsEditMode(true)
        return
      }

      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingSettings(false)
    }
  }, [accessToken, showToast])

  useEffect(() => {
    clearToast()
    void loadCompanySettings()
  }, [clearToast, loadCompanySettings])

  const handleAddressFieldChange = (
    index: number,
    field: keyof CompanyAddressForm,
    value: string,
  ) => {
    setAddresses((currentAddresses) =>
      currentAddresses.map((address, currentIndex) =>
        currentIndex === index ? { ...address, [field]: value } : address,
      ),
    )
  }

  const handleAddAddress = () => {
    setAddresses((currentAddresses) => [...currentAddresses, createEmptyAddress()])
  }

  const handleRemoveAddress = (index: number) => {
    setAddresses((currentAddresses) => {
      if (currentAddresses.length <= 1) {
        return [createEmptyAddress()]
      }

      return currentAddresses.filter((_, currentIndex) => currentIndex !== index)
    })
  }

  const buildPayload = (): CompanySettingsPayload | null => {
    const trimmedContactNumber = contactNumber.trim()
    const normalizedContactNumber = normalizeContactNumber(trimmedContactNumber)
    const trimmedEmailAddress = emailAddress.trim()
    const trimmedLinkUrl = linkUrl.trim()
    const trimmedTotalAvailableSpaceForPets = totalAvailableSpaceForPets.trim()
    const trimmedMaxRescuesPerDay = maxRescuesPerDay.trim()
    if (!trimmedContactNumber) {
      showToast('Contact number is required.', { variant: 'error' })
      return null
    }

    if (!isValidContactNumber(trimmedContactNumber)) {
      showToast('Contact number must be 7-15 digits and may start with +.', { variant: 'error' })
      return null
    }

    if (!trimmedEmailAddress) {
      showToast('Email address is required.', { variant: 'error' })
      return null
    }

    if (!isValidEmail(trimmedEmailAddress)) {
      showToast('Email address must be a valid email.', { variant: 'error' })
      return null
    }

    if (!trimmedLinkUrl) {
      showToast('Link URL is required.', { variant: 'error' })
      return null
    }

    if (!HTTP_URL_PATTERN.test(trimmedLinkUrl)) {
      showToast('Link URL must start with http:// or https://.', { variant: 'error' })
      return null
    }

    if (!trimmedTotalAvailableSpaceForPets) {
      showToast('Total available space for pets is required.', { variant: 'error' })
      return null
    }

    const parsedTotalAvailableSpaceForPets = parseWholeNumber(trimmedTotalAvailableSpaceForPets)
    if (!Number.isInteger(parsedTotalAvailableSpaceForPets) || parsedTotalAvailableSpaceForPets < 0) {
      showToast('Total available space for pets must be 0 or greater.', { variant: 'error' })
      return null
    }

    if (!trimmedMaxRescuesPerDay) {
      showToast('Maximum rescues per day is required.', { variant: 'error' })
      return null
    }

    const parsedMaxRescuesPerDay = parseWholeNumber(trimmedMaxRescuesPerDay)
    if (!Number.isInteger(parsedMaxRescuesPerDay) || parsedMaxRescuesPerDay < 1) {
      showToast('Maximum rescues per day must be at least 1.', { variant: 'error' })
      return null
    }

    if (addresses.length === 0) {
      showToast('At least one address is required.', { variant: 'error' })
      return null
    }

    const normalizedAddresses: CompanySettingsPayload['addresses'] = []

    for (let index = 0; index < addresses.length; index += 1) {
      const address = addresses[index]
      const trimmedName = address.name.trim()
      const trimmedAddress = address.address.trim()
      const longitude = parseCoordinate(address.long)
      const latitude = parseCoordinate(address.latitude)
      const labelIndex = index + 1

      if (!trimmedName || !trimmedAddress || !address.long.trim() || !address.latitude.trim()) {
        showToast(`Address #${labelIndex} requires name, address, longitude, and latitude.`, {
          variant: 'error',
        })
        return null
      }

      if (!Number.isFinite(longitude) || !isValidLongitude(longitude)) {
        showToast(`Address #${labelIndex} longitude must be between -180 and 180.`, {
          variant: 'error',
        })
        return null
      }

      if (!Number.isFinite(latitude) || !isValidLatitude(latitude)) {
        showToast(`Address #${labelIndex} latitude must be between -90 and 90.`, {
          variant: 'error',
        })
        return null
      }

      normalizedAddresses.push({
        address: trimmedAddress,
        latitude,
        long: longitude,
        name: trimmedName,
      })
    }

    return {
      addresses: normalizedAddresses,
      contactNumber: normalizedContactNumber,
      emailAddress: trimmedEmailAddress,
      linkUrl: trimmedLinkUrl,
      maxRescuesPerDay: parsedMaxRescuesPerDay,
      totalAvailableSpaceForPets: parsedTotalAvailableSpaceForPets,
    }
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!accessToken) {
      showToast('You need to sign in before updating company settings.', { variant: 'error' })
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
        setTotalAvailableSpaceForPets(nextForm.totalAvailableSpaceForPets)
        setMaxRescuesPerDay(nextForm.maxRescuesPerDay)
        setAddresses(nextForm.addresses.length > 0 ? nextForm.addresses : [createEmptyAddress()])
        setSettingsRecord(response)
        setIsEditMode(false)
        showToast(
          settingsRecord ? 'Company settings updated successfully.' : 'Company settings created successfully.',
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
            <h1 className={styles.pageTitle}>Company Settings</h1>
            <p className={styles.pageSubtitle}>
              Configure contact details, rescue capacity, and mapped company addresses for all users.
            </p>
          </header>

          <form className={styles.formPanel} onSubmit={handleSave} noValidate>
            <label className={styles.fieldLabel}>
              <span>
                Contact Number <span className={styles.requiredMark}>*</span>
              </span>
              {isEditMode ? (
                <input
                  type="tel"
                  inputMode="tel"
                  pattern="^\\+?[0-9]{7,15}$"
                  className={styles.fieldInput}
                  value={contactNumber}
                  onChange={(event) => {
                    setContactNumber(event.target.value)
                  }}
                  placeholder="+63 912 345 6789"
                  disabled={isSavingSettings || isLoadingSettings}
                />
              ) : (
                <span className={styles.detailValue}>{contactNumber.trim() || 'N/A'}</span>
              )}
            </label>

            <label className={styles.fieldLabel}>
              <span>
                Email Address <span className={styles.requiredMark}>*</span>
              </span>
              {isEditMode ? (
                <input
                  type="email"
                  className={styles.fieldInput}
                  value={emailAddress}
                  onChange={(event) => {
                    setEmailAddress(event.target.value)
                  }}
                  placeholder="hello@pawtnercare.com"
                  disabled={isSavingSettings || isLoadingSettings}
                />
              ) : (
                <span className={styles.detailValue}>{emailAddress.trim() || 'N/A'}</span>
              )}
            </label>

            <label className={styles.fieldLabel}>
              <span>
                Link URL <span className={styles.requiredMark}>*</span>
              </span>
              {isEditMode ? (
                <input
                  type="url"
                  className={styles.fieldInput}
                  value={linkUrl}
                  onChange={(event) => {
                    setLinkUrl(event.target.value)
                  }}
                  placeholder="https://pawtnercare.com"
                  disabled={isSavingSettings || isLoadingSettings}
                />
              ) : (
                <a
                  href={linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${styles.detailValue} ${styles.detailLink}`}
                >
                  {linkUrl.trim() || 'N/A'}
                </a>
              )}
            </label>

            <div className={styles.coordinateGrid}>
              <label className={styles.fieldLabel}>
                <span>
                  Total Available Space For Pets <span className={styles.requiredMark}>*</span>
                </span>
                {isEditMode ? (
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={styles.fieldInput}
                    value={totalAvailableSpaceForPets}
                    onChange={(event) => {
                      setTotalAvailableSpaceForPets(event.target.value)
                    }}
                    placeholder="120"
                    disabled={isSavingSettings || isLoadingSettings}
                  />
                ) : (
                  <span className={styles.detailValue}>{totalAvailableSpaceForPets.trim() || 'N/A'}</span>
                )}
              </label>

              <label className={styles.fieldLabel}>
                <span>
                  Max Rescues Per Day <span className={styles.requiredMark}>*</span>
                </span>
                {isEditMode ? (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className={styles.fieldInput}
                    value={maxRescuesPerDay}
                    onChange={(event) => {
                      setMaxRescuesPerDay(event.target.value)
                    }}
                    placeholder="3"
                    disabled={isSavingSettings || isLoadingSettings}
                  />
                ) : (
                  <span className={styles.detailValue}>{maxRescuesPerDay.trim() || 'N/A'}</span>
                )}
              </label>
            </div>

            <div className={styles.addressHeader}>
              <h2 className={styles.sectionTitle}>
                Company Addresses <span className={styles.requiredMark}>*</span>
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

            {filteredAddresses.length === 0 ? (
              <div className={styles.emptyState}>No matching addresses for your search.</div>
            ) : (
              <div className={styles.addressGrid}>
                {filteredAddresses.map(({ address, index }) => {
                  const key = `${index}-${address.name}-${address.address}`

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
                          <input
                            type="text"
                            className={styles.fieldInput}
                            value={address.name}
                            onChange={(event) => {
                              handleAddressFieldChange(index, 'name', event.target.value)
                            }}
                            placeholder="Main Office"
                            disabled={isSavingSettings || isLoadingSettings}
                          />
                        ) : (
                          <span className={styles.detailValue}>{address.name.trim() || 'N/A'}</span>
                        )}
                      </label>

                      <label className={styles.fieldLabel}>
                        <span>
                          Address <span className={styles.requiredMark}>*</span>
                        </span>
                        {isEditMode ? (
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
                            }}
                          />
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
                        setTotalAvailableSpaceForPets(nextForm.totalAvailableSpaceForPets)
                        setMaxRescuesPerDay(nextForm.maxRescuesPerDay)
                        setAddresses(nextForm.addresses.length > 0 ? nextForm.addresses : [createEmptyAddress()])
                        setIsEditMode(false)
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
                    {isSavingSettings ? 'Saving...' : 'Save Company Settings'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={() => {
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
        </section>
      </div>
    </MainLayout>
  )
}

export default CompanySettingsPage
