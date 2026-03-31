import styles from './Toast.module.css'

export type ToastVariant = 'info' | 'success' | 'error'

export type ToastState = {
  message: string
  variant: ToastVariant
}

type ToastProps = {
  toast: ToastState | null
  onClose: () => void
}

function Toast({ toast, onClose }: ToastProps) {
  if (!toast) {
    return null
  }

  const isError = toast.variant === 'error'

  return (
    <div
      className={styles.viewport}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <div className={`${styles.toast} ${styles[toast.variant]}`}>
        <span className={styles.indicator} aria-hidden="true" />
        <p className={styles.message}>{toast.message}</p>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close notification"
        >
          x
        </button>
      </div>
    </div>
  )
}

export default Toast
