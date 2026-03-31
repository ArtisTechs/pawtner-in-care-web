import { useEffect, useState } from 'react'
import ChartCard from '../../components/dashboard/ChartCard/ChartCard'
import DonationChart from '../../components/dashboard/charts/DonationChart'
import ReportDetailsChart from '../../components/dashboard/charts/ReportDetailsChart'
import StatCard from '../../components/dashboard/StatCard/StatCard'
import Header from '../../components/layout/Header/Header'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import Sidebar from '../../components/layout/Sidebar/Sidebar'
import { userStorage } from '../../services/user/user.storage'
import type { AuthSession } from '../../types/auth-api'
import type {
  ChartFilterOption,
  ChartRange,
  HeaderProfile,
  SidebarItemKey,
} from '../../types/dashboard'
import {
  donationData,
  headerProfile,
  reportDetailsData,
  sidebarBottomItems,
  sidebarLogo,
  sidebarMenuItems,
  statCards,
} from './dashboardData'
import styles from './DashboardPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'dashboard'
const MOBILE_MENU_BREAKPOINT_QUERY = '(max-width: 960px)'
const CHART_FILTER_OPTIONS: ChartFilterOption[] = [
  { value: 'day', label: 'This Day' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
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

const resolveProfilePatch = (value: unknown): Partial<HeaderProfile> => {
  const name =
    getStringField(value, ['name', 'fullName', 'fullname', 'displayName']) ||
    [getStringField(value, ['firstName', 'firstname']), getStringField(value, ['lastName', 'lastname'])]
      .filter(Boolean)
      .join(' ')
      .trim()

  const role =
    getStringField(value, ['role', 'userRole', 'userType']) ||
    (isRecord(value) ? getStringField(value.role, ['name', 'label', 'title']) : '')

  const avatarSrc = getStringField(value, [
    'avatarSrc',
    'avatar',
    'photoUrl',
    'photoURL',
    'profileImage',
    'image',
  ])

  const profilePatch: Partial<HeaderProfile> = {}

  if (name) {
    profilePatch.name = name
  }

  if (role) {
    profilePatch.role = role
  }

  if (avatarSrc) {
    profilePatch.avatarSrc = avatarSrc
  }

  return profilePatch
}

interface DashboardPageProps {
  session?: AuthSession | null
}

function DashboardPage({ session }: DashboardPageProps) {
  const [searchValue, setSearchValue] = useState('')
  const [reportFilter, setReportFilter] = useState<ChartRange>('week')
  const [donationFilter, setDonationFilter] = useState<ChartRange>('week')
  const [resolvedHeaderProfile, setResolvedHeaderProfile] = useState<HeaderProfile>(headerProfile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    let isMounted = true

    const hydrateHeaderProfile = async () => {
      const sessionUser = session?.user
      const sessionUserId = getStringField(sessionUser, ['id', 'userId'])
      const cachedUser = sessionUserId ? await userStorage.getUserProfile(sessionUserId) : null

      const nextHeaderProfile: HeaderProfile = {
        ...headerProfile,
        ...resolveProfilePatch(sessionUser),
        ...resolveProfilePatch(cachedUser),
      }

      if (isMounted) {
        setResolvedHeaderProfile(nextHeaderProfile)
      }
    }

    hydrateHeaderProfile()

    return () => {
      isMounted = false
    }
  }, [session])

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MENU_BREAKPOINT_QUERY)
    const syncMenuState = (matchesMobileBreakpoint: boolean) => {
      setIsSidebarOpen(!matchesMobileBreakpoint)
    }

    syncMenuState(mediaQuery.matches)

    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      syncMenuState(event.matches)
    }

    mediaQuery.addEventListener('change', handleMediaQueryChange)

    return () => {
      mediaQuery.removeEventListener('change', handleMediaQueryChange)
    }
  }, [])

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
        />
      }
    >
      <div className={styles.page}>
        <section className={styles.container}>
          <h1 className={styles.pageTitle}>Dashboard</h1>

          <div className={styles.statsGrid}>
            {statCards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </div>

          <div className={styles.chartsStack}>
            <ChartCard
              title="Total Report Details"
              filterAriaLabel="Report details range"
              filterOptions={CHART_FILTER_OPTIONS}
              filterValue={reportFilter}
              onFilterChange={setReportFilter}
            >
              <ReportDetailsChart data={reportDetailsData} />
            </ChartCard>

            <ChartCard
              title="Total Donation"
              filterAriaLabel="Donation range"
              filterOptions={CHART_FILTER_OPTIONS}
              filterValue={donationFilter}
              onFilterChange={setDonationFilter}
            >
              <DonationChart data={donationData} />
            </ChartCard>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

export default DashboardPage
