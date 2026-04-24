import type { ChatMessage } from '@/features/chat/types/chat-api'
import SeenStatus from './SeenStatus'
import styles from './MessageBubble.module.css'

interface MessageBubbleProps {
  animateOnEnter?: boolean
  message: ChatMessage
  showSeenStatus?: boolean
}

const IMAGE_PATH_PATTERN = /\.(apng|avif|bmp|gif|jfif|jpe?g|png|svg|tiff?|webp)(\?.*)?$/i
const CLOUDINARY_IMAGE_PATH_PATTERN = /\/image\/upload(?:\/|$)/i
const URL_PATTERN = /https?:\/\/[^\s]+/i

const normalizeHttpLikeUrl = (value: string) => {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    return ''
  }

  const protocolIndex = normalizedValue.search(/https?:\/\//i)

  if (protocolIndex > 0) {
    return normalizedValue.slice(protocolIndex)
  }

  if (normalizedValue.startsWith('//')) {
    return `https:${normalizedValue}`
  }

  return normalizedValue
}

const isImageUrl = (value: string) => {
  const normalized = normalizeHttpLikeUrl(value)
  if (!normalized) {
    return false
  }

  try {
    const parsedUrl = new URL(normalized)
    return IMAGE_PATH_PATTERN.test(parsedUrl.pathname) || CLOUDINARY_IMAGE_PATH_PATTERN.test(parsedUrl.pathname)
  } catch {
    return IMAGE_PATH_PATTERN.test(normalized) || CLOUDINARY_IMAGE_PATH_PATTERN.test(normalized)
  }
}

const extractImageUrlFromText = (value: string) => {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return {
      imageUrl: '',
      text: '',
    }
  }

  const matchedUrl = normalizedValue.match(URL_PATTERN)
  if (!matchedUrl || matchedUrl.index === undefined) {
    return {
      imageUrl: '',
      text: normalizedValue,
    }
  }

  const rawUrl = matchedUrl[0]
  const imageUrl = normalizeHttpLikeUrl(rawUrl)
  if (!isImageUrl(imageUrl)) {
    return {
      imageUrl: '',
      text: normalizedValue,
    }
  }

  const before = normalizedValue.slice(0, matchedUrl.index).trim()
  const after = normalizedValue.slice(matchedUrl.index + rawUrl.length).trim()

  return {
    imageUrl,
    text: [before, after].filter(Boolean).join(' ').trim(),
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
  const { imageUrl: bodyImageUrl, text: bodyText } = extractImageUrlFromText(normalizedBody)
  const attachmentUrl = normalizeHttpLikeUrl(message.attachment?.url?.trim() ?? '')
  const attachmentIsImage =
    Boolean(attachmentUrl) &&
    (Boolean(message.attachment?.mimeType?.toLowerCase().startsWith('image/')) || isImageUrl(attachmentUrl))
  const imageUrl = attachmentIsImage ? attachmentUrl : bodyImageUrl
  const shouldRenderBody = Boolean(bodyText)

  return (
    <div className={`${styles.row} ${isOutgoing ? styles.rowOutgoing : styles.rowIncoming}`}>
      <article
        className={`${styles.bubble} ${isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming} ${imageUrl ? styles.bubbleWithImage : ''} ${animateOnEnter ? styles.bubbleEnter : ''}`}
      >
        {shouldRenderBody ? <p className={styles.body}>{bodyText}</p> : null}

        {imageUrl ? (
          <a href={imageUrl} target="_blank" rel="noreferrer" className={styles.imageLink}>
            <img src={imageUrl} alt="Sent image" loading="lazy" className={styles.imagePreview} />
          </a>
        ) : null}

        {message.attachment ? (
          <div className={styles.attachmentWrap}>
            {attachmentUrl && !attachmentIsImage ? (
              <a href={attachmentUrl} target="_blank" rel="noreferrer" className={styles.attachmentLink}>
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
