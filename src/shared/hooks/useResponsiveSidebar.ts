import { useEffect, useState } from 'react'

const DEFAULT_BREAKPOINT_QUERY = '(max-width: 960px)'
const SIDEBAR_OPEN_STORAGE_KEY = 'layout.sidebar.open'

const readStoredSidebarState = () => {
  try {
    const storedValue = window.localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY)
    if (storedValue === null) {
      return null
    }

    return storedValue === 'true'
  } catch {
    return null
  }
}

const resolveDefaultSidebarState = (breakpointQuery: string) => {
  if (typeof window === 'undefined') {
    return true
  }

  const storedSidebarState = readStoredSidebarState()
  if (storedSidebarState !== null) {
    return storedSidebarState
  }

  return !window.matchMedia(breakpointQuery).matches
}

export const useResponsiveSidebar = (breakpointQuery = DEFAULT_BREAKPOINT_QUERY) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    resolveDefaultSidebarState(breakpointQuery),
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(breakpointQuery)
    const syncMenuState = (matchesMobileBreakpoint: boolean) => {
      if (readStoredSidebarState() !== null) {
        return
      }

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
  }, [breakpointQuery])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(isSidebarOpen))
    } catch {
      // Ignore localStorage write failures and keep in-memory state.
    }
  }, [isSidebarOpen])

  return {
    isSidebarOpen,
    setIsSidebarOpen,
  }
}
