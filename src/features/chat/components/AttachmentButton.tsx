import { FaPaperclip } from 'react-icons/fa'
import styles from './AttachmentButton.module.css'

interface AttachmentButtonProps {
  disabled?: boolean
  onPickFile: (file: File) => void
}

function AttachmentButton({ disabled = false, onPickFile }: AttachmentButtonProps) {
  return (
    <label className={`${styles.root} ${disabled ? styles.rootDisabled : ''}`} aria-label="Attach image or file">
      <input
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        className={styles.hiddenInput}
        disabled={disabled}
        onChange={(event) => {
          const selectedFile = event.target.files?.[0]
          event.target.value = ''

          if (!selectedFile) {
            return
          }

          onPickFile(selectedFile)
        }}
      />
      <FaPaperclip aria-hidden="true" />
    </label>
  )
}

export default AttachmentButton
