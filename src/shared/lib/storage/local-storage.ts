const safeGet = (key: string) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const safeSet = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can fail in private mode or restrictive browser settings.
  }
}

const safeRemove = (key: string) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Storage can fail in private mode or restrictive browser settings.
  }
}

export const localStorageService = {
  get: safeGet,
  remove: safeRemove,
  set: safeSet,
}
