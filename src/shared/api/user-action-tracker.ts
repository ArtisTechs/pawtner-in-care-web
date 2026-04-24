const USER_ACTION_WINDOW_MS = 1400

let hasInitializedListeners = false
let lastUserActionAt = 0

const markUserAction = () => {
  lastUserActionAt = Date.now()
}

const handleKeyboardInteraction = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    markUserAction()
  }
}

export const initializeUserActionTracking = () => {
  if (hasInitializedListeners || typeof document === 'undefined') {
    return
  }

  hasInitializedListeners = true

  document.addEventListener('click', markUserAction, true)
  document.addEventListener('submit', markUserAction, true)
  document.addEventListener('keydown', handleKeyboardInteraction, true)
  document.addEventListener('touchstart', markUserAction, true)
  document.addEventListener('pointerdown', markUserAction, true)
}

export const wasRecentlyTriggeredByUserAction = () =>
  Date.now() - lastUserActionAt <= USER_ACTION_WINDOW_MS
