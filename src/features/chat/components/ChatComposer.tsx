import { FaTimes } from 'react-icons/fa'
import { CHAT_MESSAGE_MAX_LENGTH } from '@/features/chat/constants/chat.constants'
import AttachmentButton from './AttachmentButton'
import styles from './ChatComposer.module.css'

interface ChatComposerProps {
  attachedFile: File | null
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
  disabled = false,
  isSending = false,
  onAttach,
  onClearAttachment,
  onSend,
  onTextChange,
  text,
}: ChatComposerProps) {
  const messageLength = text.length
  const isSendDisabled = disabled || isSending || (!text.trim() && !attachedFile)

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
      <div className={styles.inputColumn}>
        {attachedFile ? (
          <div className={styles.attachmentRow}>
            <span className={styles.attachmentLabel}>{attachedFile.name}</span>
            <button
              type="button"
              className={styles.attachmentClearButton}
              onClick={onClearAttachment}
              aria-label="Remove attachment"
            >
              <FaTimes aria-hidden="true" />
            </button>
          </div>
        ) : null}

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
        <div className={styles.messageLengthIndicator} aria-live="polite">
          {messageLength}/{CHAT_MESSAGE_MAX_LENGTH}
        </div>
      </div>

      <AttachmentButton disabled={disabled || isSending} onPickFile={onAttach} />

      <button type="submit" className={styles.sendButton} disabled={isSendDisabled} aria-label="Send message">
        <span>Send</span>
      </button>
    </form>
  )
}

export default ChatComposer
