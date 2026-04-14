import { APP_ROUTES } from '@/app/routes/route-paths'
import type { NotificationItem } from '@/features/notifications/types/notification-api'

const toNormalizedToken = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

const resolveChatConversationRoute = (referenceId: string | null) => {
  if (!referenceId) {
    return APP_ROUTES.inbox
  }

  return `${APP_ROUTES.inbox}/${encodeURIComponent(referenceId)}`
}

// Mirrors backend guide enums in pawtner_core.pawtner_care_api.notification.
const referenceTypeRouteMap: Record<string, string> = {
  ACHIEVEMENT: APP_ROUTES.achievements,
  ADOPTION_REQUEST: APP_ROUTES.adoptionRequests,
  CHAT_CONVERSATION: APP_ROUTES.inbox,
  COMMUNITY_POST: APP_ROUTES.communityListing,
  DONATION_TRANSACTION: APP_ROUTES.donationLogs,
  EMERGENCY_SOS: APP_ROUTES.emergencySos,
  GIFT_ENTRY: APP_ROUTES.giftLogs,
  PET: APP_ROUTES.petList,
  SUPPORT_CONVERSATION: APP_ROUTES.inbox,
  TODO_ITEM: APP_ROUTES.toDoList,
}

const typeRouteMap: Record<string, string> = {
  ACHIEVEMENT: APP_ROUTES.achievements,
  ADOPTION: APP_ROUTES.adoptionRequests,
  CHAT: APP_ROUTES.inbox,
  COMMUNITY_LOG: APP_ROUTES.communityListing,
  DONATION_LOG: APP_ROUTES.donationLogs,
  GIFT_LOG: APP_ROUTES.giftLogs,
  SOS_LOG: APP_ROUTES.emergencySos,
  SYSTEM: APP_ROUTES.notifications,
  TODO: APP_ROUTES.toDoList,
}

const referenceTypeAliasMap: Record<string, string> = {
  DONATION_LOG: 'DONATION_TRANSACTION',
  EMERGENCY: 'EMERGENCY_SOS',
  GIFT_LOG: 'GIFT_ENTRY',
  SOS: 'EMERGENCY_SOS',
  TODO: 'TODO_ITEM',
}

const typeAliasMap: Record<string, string> = {
  EMERGENCY_SOS: 'SOS_LOG',
  SOS: 'SOS_LOG',
  TO_DO: 'TODO',
}

const keywordRouteMap: ReadonlyArray<[keyword: string, route: string]> = [
  ['VOLUNTEER', APP_ROUTES.volunteerList],
  ['EMERGENCY_SOS', APP_ROUTES.emergencySos],
  ['SOS', APP_ROUTES.emergencySos],
  ['DONATION', APP_ROUTES.donationLogs],
  ['GIFT', APP_ROUTES.giftLogs],
  ['TO_DO', APP_ROUTES.toDoList],
  ['TODO', APP_ROUTES.toDoList],
  ['COMMUNITY', APP_ROUTES.communityListing],
  ['ADOPTION', APP_ROUTES.adoptionRequests],
  ['ACHIEVEMENT', APP_ROUTES.achievements],
  ['EVENT', APP_ROUTES.eventList],
]

const toCanonicalReferenceType = (value: string | null | undefined) => {
  const normalized = toNormalizedToken(value)
  if (!normalized) {
    return ''
  }

  return referenceTypeAliasMap[normalized] ?? normalized
}

const toCanonicalType = (value: string | null | undefined) => {
  const normalized = toNormalizedToken(value)
  if (!normalized) {
    return ''
  }

  return typeAliasMap[normalized] ?? normalized
}

const resolveRouteByKeywords = (notification: NotificationItem) => {
  const normalizedText = toNormalizedToken(`${notification.title} ${notification.message}`)
  if (!normalizedText) {
    return null
  }

  for (const [keyword, route] of keywordRouteMap) {
    if (normalizedText.includes(keyword)) {
      return route
    }
  }

  return null
}

export const resolveNotificationRoute = (notification: NotificationItem) => {
  const normalizedReferenceType = toCanonicalReferenceType(notification.referenceType)

  if (
    normalizedReferenceType === 'CHAT_CONVERSATION' ||
    normalizedReferenceType === 'SUPPORT_CONVERSATION'
  ) {
    return resolveChatConversationRoute(notification.referenceId)
  }

  if (normalizedReferenceType !== 'OTHER') {
    const routeByReferenceType = referenceTypeRouteMap[normalizedReferenceType]
    if (routeByReferenceType) {
      return routeByReferenceType
    }
  }

  const normalizedType = toCanonicalType(notification.type)
  if (normalizedType === 'CHAT') {
    return resolveChatConversationRoute(notification.referenceId)
  }

  const routeByType = typeRouteMap[normalizedType]
  if (routeByType) {
    return routeByType
  }

  return resolveRouteByKeywords(notification) ?? APP_ROUTES.notifications
}
