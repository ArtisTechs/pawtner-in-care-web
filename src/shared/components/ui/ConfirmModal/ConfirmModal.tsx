import { useEffect } from 'react'
import styles from './ConfirmModal.module.css'

type ConfirmModalProps = {
  ariaLabel?: string
  cancelLabel?: string
  confirmLabel?: string
  isBusy?: boolean
  isOpen: boolean
  message: string
  onCancel: () => void
  onConfirm: () => void
  title: string
}

function ConfirmModal({
  ariaLabel = 'Confirmation dialog',
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  isBusy = false,
  isOpen,
  message,
  onCancel,
  onConfirm,
  title,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isBusy, isOpen, onCancel])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onCancel()
        }
      }}
    >
      <div className={styles.card} role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <div className={styles.header}>
          <h4 className={styles.title}>{title}</h4>
          <button type="button" className={styles.closeButton} onClick={onCancel} disabled={isBusy}>
            x
          </button>
        </div>

        <p className={styles.message}>{message}</p>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </button>
          <button type="button" className={styles.confirmButton} onClick={onConfirm} disabled={isBusy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
