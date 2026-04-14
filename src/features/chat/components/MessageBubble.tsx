import type { ChatMessage } from '@/features/chat/types/chat-api'
import SeenStatus from './SeenStatus'
import styles from './MessageBubble.module.css'

interface MessageBubbleProps {
  animateOnEnter?: boolean
  message: ChatMessage
  showSeenStatus?: boolean
}

const IMAGE_PATH_PATTERN = /\.(apng|avif|bmp|gif|jfif|jpe?g|png|svg|tiff?|webp)(\?.*)?$/i

const isImageUrl = (value: string) => {
  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  try {
    const parsedUrl = new URL(normalized)
    return IMAGE_PATH_PATTERN.test(parsedUrl.pathname)
  } catch {
    return IMAGE_PATH_PATTERN.test(normalized)
  }
}

const formatMessageTimestamp = (value: string) => {
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return '--'
  }

  return parsedDate.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    hour12: true,
    minute: '2-digit',
  })
}

function MessageBubble({ animateOnEnter = false, message, showSeenStatus = true }: MessageBubbleProps) {
  const isOutgoing = message.direction === 'OUTGOING'
  const normalizedBody = message.body?.trim() ?? ''
  const bodyIsImageUrl = isImageUrl(normalizedBody)
  const attachmentUrl = message.attachment?.url?.trim() ?? ''
  const attachmentIsImage =
    Boolean(attachmentUrl) &&
    (Boolean(message.attachment?.mimeType?.toLowerCase().startsWith('image/')) || isImageUrl(attachmentUrl))
  const imageUrl = attachmentIsImage ? attachmentUrl : bodyIsImageUrl ? normalizedBody : ''
  const isImageOnlyMessage = Boolean(imageUrl && !message.attachment && bodyIsImageUrl)
  const shouldRenderBody = Boolean(normalizedBody) && !isImageOnlyMessage

  return (
    <div className={`${styles.row} ${isOutgoing ? styles.rowOutgoing : styles.rowIncoming}`}>
      <article
        className={`${styles.bubble} ${isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming} ${imageUrl ? styles.bubbleWithImage : ''} ${animateOnEnter ? styles.bubbleEnter : ''}`}
      >
        {shouldRenderBody ? <p className={styles.body}>{normalizedBody}</p> : null}

        {imageUrl ? (
          <a href={imageUrl} target="_blank" rel="noreferrer" className={styles.imageLink}>
            <img src={imageUrl} alt="Sent image" loading="lazy" className={styles.imagePreview} />
          </a>
        ) : null}

        {message.attachment ? (
          <div className={styles.attachmentWrap}>
            {message.attachment.url && !attachmentIsImage ? (
              <a href={message.attachment.url} target="_blank" rel="noreferrer" className={styles.attachmentLink}>
                {message.attachment.name}
              </a>
            ) : !attachmentIsImage ? (
              <span className={styles.attachmentText}>{message.attachment.name}</span>
            ) : null}
          </div>
        ) : null}

        <footer className={styles.meta}>
          <span>{formatMessageTimestamp(message.createdAt)}</span>
          {isOutgoing && showSeenStatus ? (
            <SeenStatus readState={message.readState} seenAt={message.seenAt} />
          ) : null}
        </footer>
      </article>
    </div>
  )
}

export default MessageBubble
