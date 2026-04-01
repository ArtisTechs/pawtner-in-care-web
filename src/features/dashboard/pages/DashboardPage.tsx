import { useState } from 'react'
import type { AuthSession } from '@/features/auth/types/auth-api'
import ChartCard from '@/features/dashboard/components/ChartCard/ChartCard'
import DonationChart from '@/features/dashboard/components/charts/DonationChart'
import ReportDetailsChart from '@/features/dashboard/components/charts/ReportDetailsChart'
import StatCard from '@/features/dashboard/components/StatCard/StatCard'
import { donationData, reportDetailsData, statCards } from '@/features/dashboard/data/dashboard.data'
import type { ChartFilterOption, ChartRange } from '@/features/dashboard/types/dashboard'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './DashboardPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'dashboard'

const CHART_FILTER_OPTIONS: ChartFilterOption[] = [
  { value: 'day', label: 'This Day' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

interface DashboardPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function DashboardPage({ onLogout, session }: DashboardPageProps) {
  const [searchValue, setSearchValue] = useState('')
  const [reportFilter, setReportFilter] = useState<ChartRange>('week')
  const [donationFilter, setDonationFilter] = useState<ChartRange>('week')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })

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
