import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import type { AuthSession } from '@/features/auth/types/auth-api'
import topPostPreviewImage from '@/assets/pet-hugging.png'
import ChartCard from '@/features/dashboard/components/ChartCard/ChartCard'
import DonationChart from '@/features/dashboard/components/charts/DonationChart'
import ReportDetailsChart from '@/features/dashboard/components/charts/ReportDetailsChart'
import StatCard from '@/features/dashboard/components/StatCard/StatCard'
import { statCards } from '@/features/dashboard/data/dashboard.data'
import { dashboardService } from '@/features/dashboard/services/dashboard.service'
import type { DashboardTopPostEntry } from '@/features/dashboard/types/dashboard-api'
import { companySettingsService } from '@/features/company-settings/services/company-settings.service'
import { petService } from '@/features/pets/services/pet.service'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import type {
  ChartFilterOption,
  ChartRange,
  DonationChartPoint,
  ReportChartPoint,
} from '@/features/dashboard/types/dashboard'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { ApiError } from '@/shared/api/api-error'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './DashboardPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'dashboard'

const CHART_FILTER_OPTIONS: ChartFilterOption[] = [
  { value: 'day', label: 'This Day' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

interface DashboardPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

type PieSegment = 'dogs' | 'cats' | 'available-space'

interface PieHoverState {
  label: string
  value: number
  x: number
  y: number
}

const getTopPostPreviewMedia = (media: DashboardTopPostEntry['post']['media'] | undefined) => {
  if (!Array.isArray(media) || !media.length) {
    return null
  }

  const [firstMedia] = [...media].sort((firstItem, secondItem) => firstItem.sortOrder - secondItem.sortOrder)
  return firstMedia ?? null
}

function DashboardPage({ onLogout, session }: DashboardPageProps) {
  const [searchValue, setSearchValue] = useState('')
  const [reportFilter, setReportFilter] = useState<ChartRange>('week')
  const [donationFilter, setDonationFilter] = useState<ChartRange>('week')
  const [reportChartData, setReportChartData] = useState<ReportChartPoint[]>([])
  const [donationChartData, setDonationChartData] = useState<DonationChartPoint[]>([])
  const [topPosts, setTopPosts] = useState<DashboardTopPostEntry[]>([])
  const [isReportChartLoading, setIsReportChartLoading] = useState(false)
  const [isDonationChartLoading, setIsDonationChartLoading] = useState(false)
  const [isTopPostsLoading, setIsTopPostsLoading] = useState(false)
  const [totalDogs, setTotalDogs] = useState<number | null>(null)
  const [totalCats, setTotalCats] = useState<number | null>(null)
  const [totalAvailableSpaceForPets, setTotalAvailableSpaceForPets] = useState<number | null>(null)
  const [topPostIndex, setTopPostIndex] = useState(0)
  const [pieHoverState, setPieHoverState] = useState<PieHoverState | null>(null)
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const accessToken = session?.accessToken?.trim() ?? ''
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })

  useEffect(() => {
    if (!accessToken) {
      setTotalDogs(null)
      setTotalCats(null)
      setTotalAvailableSpaceForPets(null)
      return
    }

    const loadPetsAndCapacity = async () => {
      const [dogsResult, catsResult, companySettingsResult] = await Promise.allSettled([
        petService.count(accessToken, { type: 'Dog' }),
        petService.count(accessToken, { type: 'Cat' }),
        companySettingsService.get(accessToken),
      ])

      if (dogsResult.status === 'fulfilled') {
        setTotalDogs(dogsResult.value)
      } else {
        setTotalDogs(null)
      }

      if (catsResult.status === 'fulfilled') {
        setTotalCats(catsResult.value)
      } else {
        setTotalCats(null)
      }

      if (companySettingsResult.status === 'fulfilled') {
        const companySettings = companySettingsResult.value
        setTotalAvailableSpaceForPets(
          Number.isFinite(companySettings.totalAvailableSpaceForPets)
            ? companySettings.totalAvailableSpaceForPets
            : 0,
        )
      } else {
        const error = companySettingsResult.reason
        if (error instanceof ApiError && error.status === 404) {
          setTotalAvailableSpaceForPets(0)
          return
        }

        setTotalAvailableSpaceForPets(null)
      }
    }

    void loadPetsAndCapacity()
  }, [accessToken])

  useEffect(() => {
    if (!accessToken) {
      setReportChartData([])
      setIsReportChartLoading(false)
      return
    }

    let isCancelled = false
    setIsReportChartLoading(true)

    const loadReportChart = async () => {
      try {
        const response = await dashboardService.getCharts(accessToken, {
          range: reportFilter,
          type: 'report',
        })

        if (isCancelled) {
          return
        }

        setReportChartData(Array.isArray(response.reportDetails) ? response.reportDetails : [])
      } catch {
        if (!isCancelled) {
          setReportChartData([])
        }
      } finally {
        if (!isCancelled) {
          setIsReportChartLoading(false)
        }
      }
    }

    void loadReportChart()

    return () => {
      isCancelled = true
    }
  }, [accessToken, reportFilter])

  useEffect(() => {
    if (!accessToken) {
      setDonationChartData([])
      setIsDonationChartLoading(false)
      return
    }

    let isCancelled = false
    setIsDonationChartLoading(true)

    const loadDonationChart = async () => {
      try {
        const response = await dashboardService.getCharts(accessToken, {
          range: donationFilter,
          type: 'donation',
        })

        if (isCancelled) {
          return
        }

        setDonationChartData(Array.isArray(response.totalDonation) ? response.totalDonation : [])
      } catch {
        if (!isCancelled) {
          setDonationChartData([])
        }
      } finally {
        if (!isCancelled) {
          setIsDonationChartLoading(false)
        }
      }
    }

    void loadDonationChart()

    return () => {
      isCancelled = true
    }
  }, [accessToken, donationFilter])

  useEffect(() => {
    if (!accessToken) {
      setTopPosts([])
      setTopPostIndex(0)
      setIsTopPostsLoading(false)
      return
    }

    let isCancelled = false
    setIsTopPostsLoading(true)

    const loadTopPosts = async () => {
      try {
        const response = await dashboardService.getTopPosts(accessToken, { top: 3 })

        if (isCancelled) {
          return
        }

        setTopPosts(Array.isArray(response) ? response : [])
      } catch {
        if (!isCancelled) {
          setTopPosts([])
        }
      } finally {
        if (!isCancelled) {
          setIsTopPostsLoading(false)
        }
      }
    }

    void loadTopPosts()

    return () => {
      isCancelled = true
    }
  }, [accessToken])

  useEffect(() => {
    if (!topPosts.length) {
      setTopPostIndex(0)
      return
    }

    setTopPostIndex((previousIndex) => Math.min(previousIndex, topPosts.length - 1))
  }, [topPosts])

  const totalReports = reportChartData.reduce((sum, point) => sum + point.value, 0)
  const totalDonations = donationChartData.reduce((sum, point) => sum + point.value, 0)

  const resolvedStatCards = useMemo(
    () =>
      statCards.map((card) => {
        if (card.id === 'total-dogs') {
          return { ...card, value: totalDogs === null ? '0' : String(totalDogs) }
        }

        if (card.id === 'total-cats') {
          return { ...card, value: totalCats === null ? '0' : String(totalCats) }
        }

        if (card.id === 'total-donation') {
          return { ...card, value: totalDonations.toLocaleString() }
        }

        if (card.id === 'total-reports') {
          return { ...card, value: totalReports.toLocaleString() }
        }

        return card
      }),
    [totalCats, totalDogs, totalDonations, totalReports],
  )
  const dogsCount = totalDogs ?? 0
  const catsCount = totalCats ?? 0
  const occupiedSpaceCount = dogsCount + catsCount
  const totalCapacityCount = totalAvailableSpaceForPets ?? 0
  const availableSpaceCount = Math.max(0, totalCapacityCount - occupiedSpaceCount)
  const pieTotal = dogsCount + catsCount + availableSpaceCount
  const dogsAngle = pieTotal > 0 ? (dogsCount / pieTotal) * 360 : 0
  const catsAngle = pieTotal > 0 ? (catsCount / pieTotal) * 360 : 0
  const catsEndAngle = dogsAngle + catsAngle
  const pieChartStyle = {
    '--dogs-angle': `${dogsAngle}deg`,
    '--cats-end-angle': `${catsEndAngle}deg`,
  } as CSSProperties

  const activeTopPostEntry = topPosts[topPostIndex]
  const activeTopPost = activeTopPostEntry?.post
  const hasMultipleTopPosts = topPosts.length > 1
  const activeTopPostTitle = activeTopPost?.content?.trim() || 'Untitled post'
  const activeTopPostPreviewMedia = getTopPostPreviewMedia(activeTopPost?.media)
  const activeTopPostMediaUrl = activeTopPostPreviewMedia?.mediaUrl?.trim() || ''
  const isActiveTopPostVideo = activeTopPostPreviewMedia?.mediaType === 'VIDEO' && activeTopPostMediaUrl.length > 0

  const handlePreviousTopPost = () => {
    if (!hasMultipleTopPosts) {
      return
    }

    setTopPostIndex((previousIndex) => (previousIndex === 0 ? topPosts.length - 1 : previousIndex - 1))
  }

  const handleNextTopPost = () => {
    if (!hasMultipleTopPosts) {
      return
    }

    setTopPostIndex((previousIndex) => (previousIndex === topPosts.length - 1 ? 0 : previousIndex + 1))
  }

  const resolvePieSegmentByAngle = (angle: number): PieSegment | null => {
    if (pieTotal <= 0) {
      return null
    }

    if (angle < dogsAngle) {
      return dogsCount > 0 ? 'dogs' : null
    }

    if (angle < catsEndAngle) {
      return catsCount > 0 ? 'cats' : null
    }

    return availableSpaceCount > 0 ? 'available-space' : null
  }

  const handlePieMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const pieRect = event.currentTarget.getBoundingClientRect()
    const offsetX = event.clientX - pieRect.left
    const offsetY = event.clientY - pieRect.top
    const radius = pieRect.width / 2
    const centerX = pieRect.width / 2
    const centerY = pieRect.height / 2
    const deltaX = offsetX - centerX
    const deltaY = offsetY - centerY
    const distanceFromCenter = Math.hypot(deltaX, deltaY)

    if (distanceFromCenter > radius) {
      setPieHoverState(null)
      return
    }

    const angle = (Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90 + 360) % 360
    const activeSegment = resolvePieSegmentByAngle(angle)

    if (!activeSegment) {
      setPieHoverState(null)
      return
    }

    if (activeSegment === 'dogs') {
      setPieHoverState({
        label: 'Dogs',
        value: dogsCount,
        x: offsetX,
        y: offsetY,
      })
      return
    }

    if (activeSegment === 'cats') {
      setPieHoverState({
        label: 'Cats',
        value: catsCount,
        x: offsetX,
        y: offsetY,
      })
      return
    }

    setPieHoverState({
      label: 'Available Space',
      value: availableSpaceCount,
      x: offsetX,
      y: offsetY,
    })
  }

  const handlePieMouseLeave = () => {
    setPieHoverState(null)
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
      <div className={styles.page}>
        <section className={styles.container}>
          <h1 className={styles.pageTitle}>Dashboard</h1>

          <div className={styles.statsGrid}>
            {resolvedStatCards.map((card) => (
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
              {isReportChartLoading ? (
                <p className={styles.chartStateMessage}>Loading report chart...</p>
              ) : !reportChartData.length ? (
                <p className={styles.chartStateMessage}>No report data available.</p>
              ) : (
                <ReportDetailsChart data={reportChartData} />
              )}
            </ChartCard>

            <ChartCard
              title="Total Donation"
              filterAriaLabel="Donation range"
              filterOptions={CHART_FILTER_OPTIONS}
              filterValue={donationFilter}
              onFilterChange={setDonationFilter}
            >
              {isDonationChartLoading ? (
                <p className={styles.chartStateMessage}>Loading donation chart...</p>
              ) : !donationChartData.length ? (
                <p className={styles.chartStateMessage}>No donation data available.</p>
              ) : (
                <DonationChart data={donationChartData} />
              )}
            </ChartCard>
          </div>

          <div className={styles.dashboardWidgetGrid}>
            <section className={styles.widgetCard} aria-label="Total pets distribution">
              <h2 className={styles.widgetTitle}>Total Pets</h2>

              <div className={styles.petsPieWrap} aria-hidden="true">
                <div
                  className={styles.petsPieChart}
                  style={pieChartStyle}
                  onMouseMove={handlePieMouseMove}
                  onMouseLeave={handlePieMouseLeave}
                />
                {pieHoverState ? (
                  <div
                    className={styles.petsPiePopover}
                    style={{
                      left: `${pieHoverState.x}px`,
                      top: `${pieHoverState.y}px`,
                    }}
                  >
                    {pieHoverState.label}: {pieHoverState.value}
                  </div>
                ) : null}
              </div>

              <div className={styles.petsLegendRow}>
                <div className={styles.petsLegendItem}>
                  <p className={styles.petsLegendValue}>{dogsCount}</p>
                  <p className={styles.petsLegendLabel}>
                    <span className={`${styles.petsLegendDot} ${styles.petsLegendDotPrimary}`} aria-hidden="true" />
                    Dogs
                  </p>
                </div>
                <div className={styles.petsLegendItem}>
                  <p className={styles.petsLegendValue}>{catsCount}</p>
                  <p className={styles.petsLegendLabel}>
                    <span className={`${styles.petsLegendDot} ${styles.petsLegendDotMuted}`} aria-hidden="true" />
                    Cats
                  </p>
                </div>
                <div className={styles.petsLegendItem}>
                  <p className={styles.petsLegendValue}>{availableSpaceCount}</p>
                  <p className={styles.petsLegendLabel}>
                    <span className={`${styles.petsLegendDot} ${styles.petsLegendDotSpace}`} aria-hidden="true" />
                    Available Space
                  </p>
                </div>
              </div>
            </section>

            <section className={styles.widgetCard} aria-label="Top post">
              <h2 className={styles.widgetTitle}>Top Post</h2>

              <div className={styles.topPostRow}>
                <button
                  type="button"
                  className={styles.topPostArrowButton}
                  onClick={handlePreviousTopPost}
                  aria-label="Show previous top post"
                  disabled={!hasMultipleTopPosts}
                >
                  <FaChevronLeft aria-hidden="true" />
                </button>

                <div className={styles.topPostMain}>
                  {isTopPostsLoading ? (
                    <p className={styles.topPostStateMessage}>Loading top posts...</p>
                  ) : activeTopPost ? (
                    <>
                      {isActiveTopPostVideo ? (
                        <video className={styles.topPostImage} controls preload="metadata" playsInline>
                          <source src={activeTopPostMediaUrl} />
                        </video>
                      ) : (
                        <img
                          src={activeTopPostMediaUrl || topPostPreviewImage}
                          alt={activeTopPostTitle}
                          className={styles.topPostImage}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.src = topPostPreviewImage
                          }}
                        />
                      )}
                      <p className={styles.topPostTitle}>{activeTopPostTitle}</p>
                      <p className={styles.topPostParticipants}>
                        {activeTopPost.likeCount ?? 0} Likes • {activeTopPost.commentCount ?? 0} Comments
                      </p>
                    </>
                  ) : (
                    <p className={styles.topPostStateMessage}>No top posts available.</p>
                  )}
                </div>

                <button
                  type="button"
                  className={styles.topPostArrowButton}
                  onClick={handleNextTopPost}
                  aria-label="Show next top post"
                  disabled={!hasMultipleTopPosts}
                >
                  <FaChevronRight aria-hidden="true" />
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

export default DashboardPage
