/**
 * Subscribing this browser to notifications.
 *
 * The one condition worth stating up front: on iOS, Web Push exists only once
 * the app has been added to the home screen. In a Safari tab the API is simply
 * absent, and asking for permission does nothing at all — so the card that
 * calls this has to be able to say that rather than offering a button that
 * quietly fails.
 */

/** Why this browser cannot be subscribed, or null when it can. */
export type PushBlocker = 'unsupported' | 'needs-install' | 'denied'

/** Whether the app is running as an installed app rather than in a tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own flag, which predates the standard one and is the only
    // signal on an iPhone.
    ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  )
}

export function pushBlocker(): PushBlocker | null {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // On iOS the API is missing entirely until the app is installed, which is
    // a different thing to tell someone than "your browser cannot do this".
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  return null
}

/** The VAPID public key travels as base64url and has to reach `subscribe` as bytes. */
function decodeKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=')
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  // Backed by a plain ArrayBuffer on purpose: `subscribe` will not take a view
  // that might sit on a SharedArrayBuffer.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** What the server stores, pulled out of the browser's subscription object. */
export interface DeviceSubscription {
  endpoint: string
  p256dh: string
  auth: string
  label: string
}

function encodeKey(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function describe(subscription: PushSubscription): DeviceSubscription {
  return {
    endpoint: subscription.endpoint,
    p256dh: encodeKey(subscription.getKey('p256dh')),
    auth: encodeKey(subscription.getKey('auth')),
    // Enough to tell a phone from a desktop in a list, and nothing more.
    label: navigator.userAgent.slice(0, 120),
  }
}

/**
 * Asks for permission and subscribes. Must be called from a real user gesture —
 * every browser refuses the prompt otherwise.
 */
export async function subscribeThisDevice(publicKey: string): Promise<DeviceSubscription> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('denied')

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  // A subscription made against a different VAPID key cannot be reused, and
  // the server would encrypt for a key this browser no longer holds.
  if (existing) await existing.unsubscribe()

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeKey(publicKey),
  })
  return describe(subscription)
}

/** Drops the browser's own subscription and reports the endpoint that was dropped. */
export async function unsubscribeThisDevice(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return null

  const { endpoint } = subscription
  await subscription.unsubscribe()
  return endpoint
}

/** Whether this browser currently holds a subscription. */
export async function currentEndpoint(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.ready
  return (await registration.pushManager.getSubscription())?.endpoint ?? null
}
