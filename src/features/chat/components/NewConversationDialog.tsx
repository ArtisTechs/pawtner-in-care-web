import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { FaTimes } from 'react-icons/fa'
import UserSearchDropdown, { type UserSearchOption } from './UserSearchDropdown'
import styles from './NewConversationDialog.module.css'

interface NewConversationDialogProps {
  accessToken: string
  currentUserId?: string
  isOpen: boolean
  isSubmitting?: boolean
  onClose: () => void
  onCreate: (selectedUser: UserSearchOption) => Promise<void> | void
}

function NewConversationDialog({
  accessToken,
  currentUserId,
  isOpen,
  isSubmitting = false,
  onClose,
  onCreate,
}: NewConversationDialogProps) {
  const [selectedUser, setSelectedUser] = useState<UserSearchOption | null>(null)
  const [showSelectionError, setShowSelectionError] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setSelectedUser(null)
      setShowSelectionError(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) {
    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedUser) {
      setShowSelectionError(true)
      return
    }

    setShowSelectionError(false)
    await onCreate(selectedUser)
  }

  const dialogContent = (
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose()
        }
      }}
    >
      <section className={styles.card} role="dialog" aria-modal="true" aria-label="Create conversation">
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>New Conversation</h2>
            <p className={styles.subtitle}>Select a user to start chatting.</p>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close create conversation dialog"
            disabled={isSubmitting}
          >
            <FaTimes aria-hidden="true" />
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <UserSearchDropdown
            accessToken={accessToken}
            excludeUserId={currentUserId}
            selectedUser={selectedUser}
            onSelect={setSelectedUser}
            label="Recipient"
          />

          {showSelectionError ? (
            <p className={styles.errorText}>Please select a user from the dropdown.</p>
          ) : null}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting || !selectedUser}
            >
              {isSubmitting ? 'Creating...' : 'New Conversation'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )

  if (typeof document === 'undefined') {
    return dialogContent
  }

  return createPortal(dialogContent, document.body)
}

export default NewConversationDialog
