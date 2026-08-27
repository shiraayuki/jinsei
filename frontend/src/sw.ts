/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

/**
 * The service worker, written out rather than generated.
 *
 * Workbox's generated worker cannot be extended, and a push notification is a
 * `push` listener inside the worker — there is nowhere else to put one. So the
 * precaching it used to do for us is three lines here, and the rest of the file
 * is the part that could not exist before.
 */
declare const self: ServiceWorkerGlobalScope

// The build list, injected at build time. Same behaviour as before: take over
// straight away rather than waiting for every tab to close, which is what
// `registerType: 'autoUpdate'` did.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
clientsClaim()

/** What the server sends. Anything malformed is shown as a bare app name. */
interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener('push', event => {
  let payload: PushPayload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    // A push with no readable body still deserves to be shown: the browser
    // will display its own placeholder if we show nothing at all, and that
    // reads worse than an empty line of ours.
  }

  const title = payload.title ?? 'Jinsei'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // The tag replaces an earlier notification of the same kind instead of
      // stacking a second one: two evening checks on the lock screen is a
      // bug, not twice the reminder.
      tag: payload.tag,
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/'

  // Focus the app if it is already open — opening a second window of an
  // installed app is how you end up with two of it on the home screen switcher.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
      for (const client of clients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    }),
  )
})
