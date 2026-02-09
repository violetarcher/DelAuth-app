/**
 * Event system for member list updates
 * Allows chat operations to trigger member list refresh
 */

export const MEMBER_EVENTS = {
  MEMBER_ADDED: 'member:added',
  MEMBER_REMOVED: 'member:removed',
  MEMBER_UPDATED: 'member:updated',
  REFRESH_MEMBERS: 'members:refresh',
} as const

export type MemberEventType = typeof MEMBER_EVENTS[keyof typeof MEMBER_EVENTS]

/**
 * Emit a member event
 */
export function emitMemberEvent(eventType: MemberEventType, data?: any) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent(eventType, { detail: data })
    window.dispatchEvent(event)
    console.log('🔔 Member event emitted:', eventType, data)
  }
}

/**
 * Listen for member events
 */
export function onMemberEvent(
  eventType: MemberEventType,
  handler: (data?: any) => void
) {
  if (typeof window !== 'undefined') {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent
      handler(customEvent.detail)
    }
    window.addEventListener(eventType, listener)

    // Return cleanup function
    return () => {
      window.removeEventListener(eventType, listener)
    }
  }
  return () => {}
}

/**
 * Trigger member list refresh
 */
export function refreshMemberList() {
  emitMemberEvent(MEMBER_EVENTS.REFRESH_MEMBERS)
}
