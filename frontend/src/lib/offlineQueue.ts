/**
 * Holds writes that could not reach the server and replays them once it is
 * reachable again.
 *
 * Safe to replay because every write in this app is an upsert keyed on a date:
 * sending the same body twice leaves the same row. Only network failures are
 * queued — an HTTP error means the server saw the request and rejected it, and
 * repeating it would not help.
 */
const KEY = 'jinsei:outbox'

export interface QueuedWrite {
  id: string
  path: string
  method: string
  body?: string
  queuedAt: number
}

type Listener = (pending: number) => void

const listeners = new Set<Listener>()

function read(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : []
  } catch {
    return []
  }
}

function write(items: QueuedWrite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // A full storage quota is not worth failing the write the user just made.
  }
  listeners.forEach(l => l(items.length))
}

export function pendingCount(): number {
  return read().length
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  listener(pendingCount())
  return () => listeners.delete(listener)
}

export function enqueue(path: string, method: string, body?: string) {
  const items = read()
  // A later write to the same endpoint supersedes an earlier one — these are
  // upserts, so only the last state matters.
  const superseded = items.filter(i => !(i.path === path && i.method === method))
  superseded.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path,
    method,
    body,
    queuedAt: Date.now(),
  })
  write(superseded)
}

let flushing = false

/** Sends what is queued, oldest first. Returns how many went through. */
export async function flush(): Promise<number> {
  if (flushing) return 0
  flushing = true
  try {
    let sent = 0
    for (const item of read()) {
      try {
        const res = await fetch(item.path, {
          method: item.method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: item.body,
        })
        // Drop it either way once the server has answered: a rejected write
        // will be rejected again, and retrying it forever would block the rest
        // of the queue.
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          write(read().filter(i => i.id !== item.id))
          if (res.ok) sent++
        }
      } catch {
        // Still offline; leave the rest for the next attempt.
        break
      }
    }
    return sent
  } finally {
    flushing = false
  }
}
