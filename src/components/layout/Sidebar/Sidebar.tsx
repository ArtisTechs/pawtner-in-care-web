import type { SidebarIconName, SidebarItemKey, SidebarMenuItem } from '../../../types/dashboard'
import styles from './Sidebar.module.css'

interface SidebarProps {
  activeItem: SidebarItemKey
  bottomItems: SidebarMenuItem[]
  logoSrc: string
  menuItems: SidebarMenuItem[]
}

interface SidebarListProps {
  activeItem: SidebarItemKey
  items: SidebarMenuItem[]
}

function Icon({ name }: { name: SidebarIconName }) {
  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 4h7v7H4V4Zm9 0h7v5h-7V4ZM4 13h5v7H4v-7Zm7 3h9v4h-9v-4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'inbox':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.2 6.5h15.6v11H4.2v-11Zm0 7.2h5l1.7 2h2.2l1.7-2h5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'pet-list':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 13.6c-1.5 0-2.9 1-3.3 2.4-.4 1.4.2 2.8 1.5 3.4 1.2.6 2.7.2 3.6-.8a3.3 3.3 0 0 0-1.8-5Zm-4.9-3.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Zm9.8 0a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8ZM12 8.5a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Zm6.1 5.2a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'adoption-logs':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 4.5h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Zm3 4h6M10 12h6M10 15.5h4M8 8.5h.01"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'donation-logs':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4.5v15m-4.2-3.1c.9.7 2.5 1.1 4.2 1.1 2.6 0 4.7-1 4.7-2.4 0-3.9-9-1.7-9-5.8 0-1.4 2.1-2.4 4.7-2.4 1.7 0 3.2.4 4.2 1.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 3.8v3M17 3.8v3M4.5 8.5h15M6.5 5.8h11a2 2 0 0 1 2 2v10.4a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7.8a2 2 0 0 1 2-2Zm2.5 5.2h2.3v2.3H9V11Zm3.8 0h2.3v2.3h-2.3V11Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'to-do':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8.5 7.5h10M8.5 12h10M8.5 16.5h10M5 7.5l.8.8 1.4-1.4M5 12l.8.8 1.4-1.4M5 16.5l.8.8 1.4-1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'contact':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.5 5.2h11a2 2 0 0 1 2 2v9.6a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V7.2a2 2 0 0 1 2-2Zm-1 3.1L12 12.7l6.5-4.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 8.7a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Zm7.2 4.2-1.3.8c0 .4-.2.8-.4 1.2l.8 1.3-1.7 1.7-1.3-.8c-.4.2-.8.3-1.2.4l-.8 1.3h-2.4l-.8-1.3c-.4 0-.8-.2-1.2-.4l-1.3.8-1.7-1.7.8-1.3c-.2-.4-.3-.8-.4-1.2l-1.3-.8v-2.4l1.3-.8c0-.4.2-.8.4-1.2l-.8-1.3L8 5.1l1.3.8c.4-.2.8-.3 1.2-.4l.8-1.3h2.4l.8 1.3c.4 0 .8.2 1.2.4l1.3-.8 1.7 1.7-.8 1.3c.2.4.3.8.4 1.2l1.3.8v2.4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'logout':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M14 6h4.5v12H14M10.5 8.5 7 12l3.5 3.5M17.8 12H7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    default:
      return null
  }
}

function SidebarList({ activeItem, items }: SidebarListProps) {
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const isActive = item.key === activeItem

        return (
          <li key={item.key}>
            <button
              type="button"
              className={`${styles.item} ${isActive ? styles.active : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.icon} aria-hidden="true">
                <Icon name={item.icon} />
              </span>
              <span className={styles.label}>{item.label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Sidebar({ activeItem, bottomItems, logoSrc, menuItems }: SidebarProps) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.logoWrap}>
        <img src={logoSrc} alt="Pawtner in Care" className={styles.logo} />
      </div>

      <nav className={styles.nav} aria-label="Main navigation">
        <SidebarList activeItem={activeItem} items={menuItems} />
      </nav>

      <div className={styles.bottomNav} aria-label="Secondary navigation">
        <SidebarList activeItem={activeItem} items={bottomItems} />
      </div>
    </div>
  )
}

export default Sidebar
