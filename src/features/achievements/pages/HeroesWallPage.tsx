import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { FaTimes, FaUserCircle } from 'react-icons/fa'
import crownIcon from '@/assets/crown-icon.png'
import type { AuthSession } from '@/features/auth/types/auth-api'
import { heroesWallService } from '@/features/achievements/services/heroes-wall.service'
import type {
  HeroAchievement,
  HeroUserDetails,
  HeroesWallEntry,
  HeroesWallPeriod,
} from '@/features/achievements/types/heroes-wall-api'
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
const HERO_LIST_PAGE_SIZE = 20

const formatPoints = (value: number) => value.toLocaleString('en-PH')
const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return 'Not available'
  }

  const dateValue = new Date(value)
  if (Number.isNaN(dateValue.getTime())) {
    return 'Not available'
  }

  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(dateValue)
}

const combineNameParts = (...parts: Array<string | null | undefined>) =>
  parts
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ')

const normalizeImageUrl = (value: string | null | undefined) => {
  const normalizedValue = value?.trim() ?? ''
  return normalizedValue || null
}

const getHeroAvatarUrl = (hero: HeroesWallEntry | null, heroDetails?: HeroUserDetails | null) =>
  normalizeImageUrl(heroDetails?.profilePicture) ??
  normalizeImageUrl(hero?.avatarUrl)

const toSearchText = (hero: HeroesWallEntry) =>
  [hero.displayName, hero.userId, hero.rank, hero.points, hero.profileLink ?? ''].join(' ').toLowerCase()

const toAchievementProgressText = (achievement: HeroAchievement) => {
  const target = achievement.progressTarget > 0 ? achievement.progressTarget : 1
  return `${achievement.progressCurrent}/${target}`
}

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
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMoreHeroes, setHasMoreHeroes] = useState(false)
  const [isLoadingMoreHeroes, setIsLoadingMoreHeroes] = useState(false)
  const [selectedHero, setSelectedHero] = useState<HeroesWallEntry | null>(null)
  const [selectedHeroDetails, setSelectedHeroDetails] = useState<HeroUserDetails | null>(null)
  const [isLoadingHeroDetails, setIsLoadingHeroDetails] = useState(false)
  const [heroDetailsError, setHeroDetailsError] = useState('')
  const { isSidebarOpen, setIsSidebarOpen } = useResponsiveSidebar()
  const resolvedHeaderProfile = useHeaderProfile({
    fallbackProfile: defaultHeaderProfile,
    session,
  })
  const accessToken = session?.accessToken?.trim() ?? ''

  const isLoadingMoreHeroesRef = useRef(false)
  const canTriggerLoadMoreRef = useRef(true)

  const loadHeroes = useCallback(async (options?: { append?: boolean; page?: number }) => {
    if (!accessToken) {
      setHeroes([])
      setCurrentPage(0)
      setHasMoreHeroes(false)
      return
    }

    const shouldAppend = Boolean(options?.append)
    const targetPage = Math.max(0, options?.page ?? 0)

    if (shouldAppend) {
      setIsLoadingMoreHeroes(true)
    } else {
      setIsLoadingHeroes(true)
    }

    try {
      const result = await heroesWallService.list(accessToken, {
        page: targetPage,
        period: activePeriod,
        size: HERO_LIST_PAGE_SIZE,
      })
      setHeroes((currentHeroes) => {
        if (!shouldAppend) {
          return result.items
        }

        const heroMap = new Map(currentHeroes.map((hero) => [hero.id, hero]))
        result.items.forEach((hero) => {
          heroMap.set(hero.id, hero)
        })

        return Array.from(heroMap.values())
      })
      setCurrentPage(result.page)
      setHasMoreHeroes(!result.isLast && result.page + 1 < result.totalPages)
    } catch (error) {
      showToast(getErrorMessage(error), { variant: 'error' })
    } finally {
      if (shouldAppend) {
        setIsLoadingMoreHeroes(false)
      } else {
        setIsLoadingHeroes(false)
      }
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
  const handleTableBodyScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMoreHeroes || isLoadingHeroes || isLoadingMoreHeroes || isLoadingMoreHeroesRef.current) {
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
      isLoadingMoreHeroesRef.current = true

      const loadMore = async () => {
        try {
          await loadHeroes({ append: true, page: currentPage + 1 })
        } finally {
          isLoadingMoreHeroesRef.current = false
        }
      }

      void loadMore()
    }
  }

  const leftPodiumHero = topThreeHeroes[2] ?? null
  const centerPodiumHero = topThreeHeroes[0] ?? null
  const rightPodiumHero = topThreeHeroes[1] ?? null

  const closeHeroDetailsModal = useCallback(() => {
    setSelectedHero(null)
    setSelectedHeroDetails(null)
    setHeroDetailsError('')
    setIsLoadingHeroDetails(false)
  }, [])

  const handleViewHeroDetails = useCallback(
    async (hero: HeroesWallEntry) => {
      if (!accessToken) {
        showToast('You need to sign in before viewing user details.', { variant: 'error' })
        return
      }

      setSelectedHero(hero)
      setSelectedHeroDetails(null)
      setHeroDetailsError('')
      setIsLoadingHeroDetails(true)

      try {
        const userDetails = await heroesWallService.getUserDetails(hero.userId, accessToken)
        setSelectedHeroDetails(userDetails)
      } catch (error) {
        const errorMessage = getErrorMessage(error)
        setHeroDetailsError(errorMessage)
        showToast(errorMessage, { variant: 'error' })
      } finally {
        setIsLoadingHeroDetails(false)
      }
    },
    [accessToken, showToast],
  )

  const selectedHeroDisplayName = useMemo(() => {
    if (!selectedHero) {
      return ''
    }

    const detailedName = combineNameParts(
      selectedHeroDetails?.firstName,
      selectedHeroDetails?.middleName,
      selectedHeroDetails?.lastName,
    )

    return detailedName || selectedHero.displayName
  }, [selectedHero, selectedHeroDetails])

  const selectedHeroAvatarUrl = getHeroAvatarUrl(selectedHero, selectedHeroDetails)
  const selectedHeroAchievements = selectedHeroDetails?.achievements ?? []
  const selectedHeroTotalPoints = Math.max(selectedHeroDetails?.totalPoints ?? 0, selectedHero?.points ?? 0)

  const renderPodiumHeroCard = (hero: HeroesWallEntry | null) => {
    if (!hero) {
      return (
        <div className={`${styles.podiumCard} ${styles.podiumPlaceholder}`} aria-hidden="true">
          <span>No hero yet</span>
        </div>
      )
    }

    const isChampion = hero.rank === 1
    const heroAvatarUrl = getHeroAvatarUrl(hero)

    return (
      <div
        className={`${styles.podiumCard} ${isChampion ? styles.podiumChampion : styles.podiumChallenger}`}
      >
        <div className={styles.avatarWrap}>
          {isChampion ? <img src={crownIcon} alt="" className={styles.crown} aria-hidden="true" /> : null}
          {heroAvatarUrl ? (
            <img src={heroAvatarUrl} alt={hero.displayName} className={styles.avatarImage} loading="lazy" />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              <FaUserCircle />
            </span>
          )}
          <span className={styles.rankBadge}>{hero.rank}</span>
        </div>
        <strong className={styles.heroName}>
          <button
            type="button"
            className={styles.heroNameButton}
            onClick={() => {
              void handleViewHeroDetails(hero)
            }}
          >
            {hero.displayName}
          </button>
        </strong>
        <span className={styles.heroPoints}>{formatPoints(hero.points)} points</span>
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
            </div>
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
            <div className={styles.podiumSparkles} aria-hidden="true">
              <span className={styles.podiumSparkle} />
              <span className={styles.podiumSparkle} />
              <span className={styles.podiumSparkle} />
              <span className={styles.podiumSparkle} />
              <span className={styles.podiumSparkle} />
              <span className={styles.podiumSparkle} />
              <span className={styles.podiumSparkle} />
              <span className={styles.podiumSparkle} />
            </div>
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
                  {renderPodiumHeroCard(leftPodiumHero)}
                </div>
                <div className={`${styles.podiumSlot} ${styles.podiumCenter}`}>
                  {renderPodiumHeroCard(centerPodiumHero)}
                </div>
                <div className={`${styles.podiumSlot} ${styles.podiumRight}`}>
                  {renderPodiumHeroCard(rightPodiumHero)}
                </div>
              </div>
            )}
          </div>

          <div className={styles.tablePanel}>
            <div className={styles.tableHeader}>
              <span>Rank</span>
              <span>User</span>
              <span className={styles.alignEnd}>Total Points</span>
            </div>

            <div className={styles.tableBody} onScroll={handleTableBodyScroll}>
              {isLoadingHeroes ? (
                Array.from({ length: 6 }, (_, rowIndex) => (
                  <div key={`hero-row-skeleton-${rowIndex}`} className={styles.rowSkeleton} aria-hidden="true" />
                ))
              ) : remainingHeroes.length === 0 ? (
                <div className={styles.tableState}>No additional ranked heroes yet.</div>
              ) : (
                remainingHeroes.map((hero) => {
                  const heroAvatarUrl = getHeroAvatarUrl(hero)

                  return (
                    <div key={hero.id} className={styles.row}>
                      <span className={styles.rankValue}>{hero.rank}</span>
                      <button
                        type="button"
                        className={styles.userCellButton}
                        onClick={() => {
                          void handleViewHeroDetails(hero)
                        }}
                      >
                        {heroAvatarUrl ? (
                          <img
                            src={heroAvatarUrl}
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
                      </button>
                      <span className={styles.pointsValue}>{formatPoints(hero.points)}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>
      </div>

      {selectedHero ? (
        <div className={styles.modalOverlay} onClick={closeHeroDetailsModal}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hero-details-modal-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalIdentity}>
                {selectedHeroAvatarUrl ? (
                  <img
                    src={selectedHeroAvatarUrl}
                    alt={selectedHeroDisplayName}
                    className={styles.modalAvatar}
                    loading="lazy"
                  />
                ) : (
                  <span className={styles.modalAvatarFallback} aria-hidden="true">
                    <FaUserCircle />
                  </span>
                )}
                <h2 id="hero-details-modal-title" className={styles.modalTitle}>
                  {selectedHeroDisplayName}
                </h2>
              </div>
              <button
                type="button"
                className={styles.modalCloseButton}
                aria-label="Close hero details modal"
                onClick={closeHeroDetailsModal}
              >
                <FaTimes />
              </button>
            </div>

            <div className={styles.modalMetaGrid}>
              <div className={styles.modalMetaCard}>
                <span className={styles.modalMetaLabel}>Total Points</span>
                <strong className={styles.modalMetaValue}>{formatPoints(selectedHeroTotalPoints)}</strong>
              </div>
              <div className={styles.modalMetaCard}>
                <span className={styles.modalMetaLabel}>Email</span>
                <strong className={styles.modalMetaValue}>
                  {selectedHeroDetails?.email?.trim() || 'Not available'}
                </strong>
              </div>
            </div>

            <section className={styles.achievementSection}>
              <h3 className={styles.achievementSectionTitle}>Achievements</h3>

              {isLoadingHeroDetails ? (
                <p className={styles.modalState}>Loading user details...</p>
              ) : heroDetailsError ? (
                <p className={styles.modalStateError}>{heroDetailsError}</p>
              ) : selectedHeroAchievements.length === 0 ? (
                <p className={styles.modalState}>No achievements found for this user.</p>
              ) : (
                <ul className={styles.achievementList}>
                  {selectedHeroAchievements.map((achievement) => (
                    <li key={achievement.id} className={styles.achievementItem}>
                      {achievement.achievement.iconUrl ? (
                        <img
                          src={achievement.achievement.iconUrl}
                          alt={achievement.achievement.title}
                          className={styles.achievementIcon}
                          loading="lazy"
                        />
                      ) : (
                        <span className={styles.achievementIconFallback} aria-hidden="true">
                          <FaUserCircle />
                        </span>
                      )}

                      <div className={styles.achievementContent}>
                        <div className={styles.achievementHeadingRow}>
                          <strong className={styles.achievementTitle}>{achievement.achievement.title}</strong>
                          <span className={styles.achievementPoints}>
                            {formatPoints(achievement.achievement.points)} pts
                          </span>
                        </div>
                        <p className={styles.achievementDescription}>
                          {achievement.achievement.description?.trim() || 'No description provided.'}
                        </p>
                        <div className={styles.achievementMetaRow}>
                          <span>Category: {achievement.achievement.category?.trim() || 'General'}</span>
                          <span>Rarity: {achievement.achievement.rarity?.trim() || 'Standard'}</span>
                          <span>Progress: {toAchievementProgressText(achievement)}</span>
                          <span>Unlocked: {formatDateTime(achievement.unlockedAt)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCloseAction} onClick={closeHeroDetailsModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MainLayout>
  )
}

export default HeroesWallPage
