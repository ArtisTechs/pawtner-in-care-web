import { FaTimes } from 'react-icons/fa'
import { CHAT_MESSAGE_MAX_LENGTH } from '@/features/chat/constants/chat.constants'
import AttachmentButton from './AttachmentButton'
import styles from './ChatComposer.module.css'

interface ChatComposerProps {
  attachedFile: File | null
  attachmentUploading?: boolean
  disabled?: boolean
  isSending?: boolean
  onAttach: (file: File) => void
  onClearAttachment: () => void
  onSend: () => void
  onTextChange: (value: string) => void
  text: string
}

function ChatComposer({
  attachedFile,
  attachmentUploading = false,
  disabled = false,
  isSending = false,
  onAttach,
  onClearAttachment,
  onSend,
  onTextChange,
  text,
}: ChatComposerProps) {
  const messageLength = text.length
  const isSendDisabled = disabled || isSending || attachmentUploading || (!text.trim() && !attachedFile)

  return (
    <form
      className={styles.root}
      onSubmit={(event) => {
        event.preventDefault()
        if (isSendDisabled) {
          return
        }

        onSend()
      }}
    >
      {attachedFile ? (
        <div className={styles.attachmentRow}>
          <span className={styles.attachmentLabel}>{attachedFile.name}</span>
          {attachmentUploading ? (
            <span className={styles.attachmentUploading}>
              <span className={styles.uploadSpinner} aria-hidden="true" />
              Uploading...
            </span>
          ) : null}
          <button
            type="button"
            className={styles.attachmentClearButton}
            onClick={onClearAttachment}
            aria-label="Remove attachment"
            disabled={attachmentUploading}
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className={styles.composerRow}>
        <input
          type="text"
          value={text}
          onChange={(event) => {
            onTextChange(event.target.value.slice(0, CHAT_MESSAGE_MAX_LENGTH))
          }}
          placeholder="Write message"
          aria-label="Type message"
          className={styles.input}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          disabled={disabled || isSending}
        />
        <AttachmentButton disabled={disabled || isSending} onPickFile={onAttach} />
        <button type="submit" className={styles.sendButton} disabled={isSendDisabled} aria-label="Send message">
          <span>Send</span>
        </button>
      </div>

      <div className={styles.messageLengthIndicator} aria-live="polite">
        {messageLength}/{CHAT_MESSAGE_MAX_LENGTH}
      </div>
    </form>
  )
}

export default ChatComposer
