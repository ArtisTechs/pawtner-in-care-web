import { useCallback, useEffect, useMemo, useState } from 'react'
import { FaSyncAlt, FaUserCircle } from 'react-icons/fa'
import crownIcon from '@/assets/crown-icon.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { heroesWallService } from '@/features/achievements/services/heroes-wall.service'
import type { HeroesWallEntry, HeroesWallPeriod } from '@/features/achievements/types/heroes-wall-api'
import { defaultHeaderProfile, sidebarBottomItems, sidebarLogo, sidebarMenuItems } from '@/layouts/config/navigation'
import Header from '@/layouts/Header/Header'
import MainLayout from '@/layouts/MainLayout/MainLayout'
import Sidebar from '@/layouts/Sidebar/Sidebar'
import { getErrorMessage } from '@/shared/api/api-error'
import Toast from '@/shared/components/feedback/Toast'
import { useHeaderProfile } from '@/shared/hooks/useHeaderProfile'
import { useResponsiveSidebar } from '@/shared/hooks/useResponsiveSidebar'
import { useToast } from '@/shared/hooks/useToast'
import type { SidebarItemKey } from '@/shared/types/layout'
import styles from './HeroesWallPage.module.css'

const ACTIVE_MENU_ITEM: SidebarItemKey = 'heroes-wall'

const PERIOD_OPTIONS: Array<{ label: string; value: HeroesWallPeriod }> = [
  { label: 'Weekly', value: 'WEEKLY' },
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'All time', value: 'ALL_TIME' },
]

const formatDonatedAmount = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    currency: 'PHP',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value)

const formatPoints = (value: number) => value.toLocaleString('en-PH')

const toSearchText = (hero: HeroesWallEntry) =>
  [hero.displayName, hero.userId, hero.rank, hero.donatedAmount, hero.points].join(' ').toLowerCase()

interface HeroesWallPageProps {
  onLogout?: () => void
  session?: AuthSession | null
}

function HeroesWallPage({ onLogout, session }: HeroesWallPageProps) {
  const { clearToast, showToast, toast } = useToast()
  const [searchValue, setSearchValue] = useState('')
  const [activePeriod, setActivePeriod] = useState<HeroesWallPeriod>('WEEKLY')
  const [isLoadingHeroes, setIsLoadingHeroes] = useState(false)
  const [heroes, setHeroes] = useState<HeroesWallEntry[]>([])
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''

  const loadHeroes = useCallback(async () => {
    if (!accessToken) {
      setHeroes([])
      return
    }

    setIsLoadingHeroes(true)

    try {
      const result = await heroesWallService.list(accessToken, {
        page: 0,
        period: activePeriod,
        size: 100,
      })
      setHeroes(result.items)
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      setIsLoadingHeroes(false)
    }
  }, [accessToken, activePeriod, showToast])

  useEffect(() => {
    clearToast()
    void loadHeroes()
  }, [clearToast, loadHeroes])

  const filteredHeroes = useMemo(() => {
    const normalizedSearchValue = searchValue.trim().toLowerCase()
    if (!normalizedSearchValue) {
      return heroes
    }

    return heroes.filter((hero) => toSearchText(hero).includes(normalizedSearchValue))
  }, [heroes, searchValue])

  const topThreeHeroes = useMemo(() => filteredHeroes.slice(0, 3), [filteredHeroes])
  const remainingHeroes = useMemo(() => filteredHeroes.slice(3), [filteredHeroes])

  const leftPodiumHero = topThreeHeroes[2] ?? null
  const centerPodiumHero = topThreeHeroes[0] ?? null
  const rightPodiumHero = topThreeHeroes[1] ?? null

  const renderPodiumHeroCard = (
    hero: HeroesWallEntry | null,
    slot: 'center' | 'left' | 'right',
  ) => {
    if (!hero) {
      return (
        <div className={`${styles.podiumCard} ${styles.podiumPlaceholder}`} aria-hidden="true">
          <span>No hero yet</span>
        </div>
      )
    }

    const isChampion = slot === 'center'
    return (
      <div className={`${styles.podiumCard} ${isChampion ? styles.podiumChampion : ''}`}>
        <div className={styles.avatarWrap}>
          {isChampion ? <img src={crownIcon} alt="" className={styles.crown} aria-hidden="true" /> : null}
          {hero.avatarUrl ? (
            <img src={hero.avatarUrl} alt={hero.displayName} className={styles.avatarImage} loading="lazy" />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              <FaUserCircle />
            </span>
          )}
          <span className={styles.rankBadge}>{hero.rank}</span>
        </div>
        <strong className={styles.heroName}>{hero.displayName}</strong>
        <span className={styles.heroDonated}>{formatDonatedAmount(hero.donatedAmount)}</span>
      </div>
    )
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
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Heroes Wall</h1>
              <p className={styles.pageSubtitle}>
                Public leaderboard of top community champions and donors.
              </p>
            </div>

            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => {
                void loadHeroes()
              }}
              disabled={isLoadingHeroes}
            >
              <FaSyncAlt aria-hidden="true" className={isLoadingHeroes ? styles.refreshIconSpin : ''} />
              <span>{isLoadingHeroes ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>

          <div className={styles.periodTabs} role="tablist" aria-label="Heroes wall period">
            {PERIOD_OPTIONS.map((periodOption) => {
              const isActive = periodOption.value === activePeriod
              return (
                <button
                  key={periodOption.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.periodTab} ${isActive ? styles.periodTabActive : ''}`}
                  onClick={() => {
                    setActivePeriod(periodOption.value)
                  }}
                >
                  {periodOption.label}
                </button>
              )
            })}
          </div>

          <div className={styles.podiumSection}>
            {isLoadingHeroes ? (
              <div className={styles.podiumLoading}>
                <div className={styles.podiumLoadingCard} />
                <div className={`${styles.podiumLoadingCard} ${styles.podiumLoadingCenterCard}`} />
                <div className={styles.podiumLoadingCard} />
              </div>
            ) : filteredHeroes.length === 0 ? (
              <div className={styles.emptyState}>No heroes found for this view.</div>
            ) : (
              <div className={styles.podiumGrid}>
                <div className={`${styles.podiumSlot} ${styles.podiumLeft}`}>
                  {renderPodiumHeroCard(leftPodiumHero, 'left')}
                </div>
                <div className={`${styles.podiumSlot} ${styles.podiumCenter}`}>
                  {renderPodiumHeroCard(centerPodiumHero, 'center')}
                </div>
                <div className={`${styles.podiumSlot} ${styles.podiumRight}`}>
                  {renderPodiumHeroCard(rightPodiumHero, 'right')}
                </div>
              </div>
            )}
          </div>

          <div className={styles.tablePanel}>
            <div className={styles.tableHeader}>
              <span>Rank</span>
              <span>User</span>
              <span className={styles.alignEnd}>Donated</span>
              <span className={styles.alignEnd}>Points</span>
            </div>

            <div className={styles.tableBody}>
              {isLoadingHeroes ? (
                Array.from({ length: 6 }, (_, rowIndex) => (
                  <div key={`hero-row-skeleton-${rowIndex}`} className={styles.rowSkeleton} aria-hidden="true" />
                ))
              ) : remainingHeroes.length === 0 ? (
                <div className={styles.tableState}>No additional ranked heroes yet.</div>
              ) : (
                remainingHeroes.map((hero) => (
                  <div key={hero.id} className={styles.row}>
                    <span className={styles.rankValue}>{hero.rank}</span>
                    <div className={styles.userCell}>
                      {hero.avatarUrl ? (
                        <img
                          src={hero.avatarUrl}
                          alt={hero.displayName}
                          className={styles.rowAvatar}
                          loading="lazy"
                        />
                      ) : (
                        <span className={styles.rowAvatarFallback} aria-hidden="true">
                          <FaUserCircle />
                        </span>
                      )}
                      <span className={styles.userName}>{hero.displayName}</span>
                    </div>
                    <span className={styles.amountValue}>{formatDonatedAmount(hero.donatedAmount)}</span>
                    <span className={styles.pointsValue}>{formatPoints(hero.points)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

export default HeroesWallPage
