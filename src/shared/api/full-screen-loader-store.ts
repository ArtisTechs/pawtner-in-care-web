type FullScreenLoaderListener = () => void

const MIN_VISIBLE_MS = 220

let activeRequestCount = 0
let isVisible = false
let visibleSince = 0
let hideTimerId: number | null = null

const listeners = new Set<FullScreenLoaderListener>()

const notify = () => {
  listeners.forEach((listener) => {
    listener()
  })
}

const clearHideTimer = () => {
  if (hideTimerId !== null) {
    window.clearTimeout(hideTimerId)
    hideTimerId = null
  }
}

const show = () => {
  clearHideTimer()

  if (isVisible) {
    return
  }

  isVisible = true
  visibleSince = Date.now()
  notify()
}

const hide = () => {
  clearHideTimer()

  if (!isVisible) {
    return
  }

  isVisible = false
  notify()
}

const scheduleHide = () => {
  if (!isVisible) {
    return
  }

  const elapsed = Date.now() - visibleSince
  const remainingDuration = MIN_VISIBLE_MS - elapsed

  if (remainingDuration <= 0) {
    hide()
    return
  }

  clearHideTimer()
  hideTimerId = window.setTimeout(() => {
    hideTimerId = null

    if (activeRequestCount === 0) {
      hide()
    }
  }, remainingDuration)
}

export const startFullScreenLoaderRequest = () => {
  activeRequestCount += 1
  show()

  let hasStopped = false

  return () => {
    if (hasStopped) {
      return
    }

    hasStopped = true
    activeRequestCount = Math.max(0, activeRequestCount - 1)

    if (activeRequestCount === 0) {
      scheduleHide()
    }
  }
}

export const subscribeToFullScreenLoader = (listener: FullScreenLoaderListener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const isFullScreenLoaderVisible = () => isVisible
