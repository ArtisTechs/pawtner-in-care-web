export type AuthSessionInvalidEvent = {
  message: string
  path: string
  status: number
}

type AuthSessionInvalidListener = (event: AuthSessionInvalidEvent) => void

const listeners = new Set<AuthSessionInvalidListener>()

export const emitAuthSessionInvalid = (event: AuthSessionInvalidEvent) => {
  listeners.forEach((listener) => {
    listener(event)
  })
}

export const subscribeToAuthSessionInvalid = (
  listener: AuthSessionInvalidListener,
) => {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
