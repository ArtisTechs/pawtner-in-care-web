import type { ReactNode } from 'react'
import styles from './MainLayout.module.css'

interface MainLayoutProps {
  header: ReactNode
  sidebar: ReactNode
  children: ReactNode
  isSidebarOpen: boolean
  onSidebarClose: () => void
}

function MainLayout({
  header,
  sidebar,
  children,
  isSidebarOpen,
  onSidebarClose,
}: MainLayoutProps) {
  return (
    <div className={styles.layout}>
      <button
        type="button"
        className={`${styles.backdrop} ${isSidebarOpen ? styles.backdropVisible : ''}`}
        aria-label="Close menu"
        onClick={onSidebarClose}
      />

      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}>
        {sidebar}
      </aside>

      <div className={`${styles.body} ${isSidebarOpen ? '' : styles.bodyExpanded}`}>
        <header className={styles.header}>{header}</header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  )
}

export default MainLayout
