import { useState, type ChangeEvent } from 'react'
import type { HeaderProfile } from '../../../types/dashboard'
import styles from './Header.module.css'

interface HeaderProps {
  profile: HeaderProfile
  searchValue: string
  onSearchChange: (value: string) => void
  isMenuOpen: boolean
  onMenuToggle: () => void
}

function Header({ profile, searchValue, onSearchChange, isMenuOpen, onMenuToggle }: HeaderProps) {
  const avatarSrc = profile.avatarSrc?.trim() ?? ''
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null)

  const shouldShowAvatarImage = avatarSrc.length > 0 && failedAvatarSrc !== avatarSrc

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value)
  }

  return (
    <div className={styles.header}>
      <div className={styles.leftSection}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          onClick={onMenuToggle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.menuIcon}>
            <path
              d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className={styles.searchField} role="search">
          <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.searchIcon}>
            <path
              d="M10.8 4.8a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm8.4 13.2-2.8-2.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Search"
            aria-label="Search dashboard"
            className={styles.searchInput}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.iconButton} aria-label="Notifications">
          <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.notificationIcon}>
            <path
              d="M7 9a5 5 0 1 1 10 0v5.2l1.5 2.1c.2.3 0 .7-.4.7H5.9a.5.5 0 0 1-.4-.7L7 14.2V9Zm3.8 10a1.2 1.2 0 0 0 2.4 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button type="button" className={styles.profileButton} aria-label="Open profile menu">
          {shouldShowAvatarImage ? (
            <img
              src={avatarSrc}
              alt={`${profile.name} avatar`}
              className={styles.avatar}
              onError={() => {
                setFailedAvatarSrc(avatarSrc)
              }}
            />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              <svg viewBox="0 0 24 24" className={styles.avatarIcon}>
                <path
                  d="M12 12.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6.2 7.6c.8-3.2 3.3-5 6.2-5s5.4 1.8 6.2 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          )}
          <span className={styles.profileText}>
            <span className={styles.name}>{profile.name}</span>
            <span className={styles.role}>{profile.role}</span>
          </span>
        </button>
      </div>
    </div>
  )
}

export default Header
