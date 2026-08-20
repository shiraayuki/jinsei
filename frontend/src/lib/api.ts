import { enqueue } from './offlineQueue'

const BASE = '/api'

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Thrown for a write that was parked in the outbox instead of sent. */
class QueuedOfflineError extends Error {
  constructor() {
    super('offline')
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
    })
  } catch (cause) {
    // The request never reached the server. Writes are upserts, so parking one
    // and replaying it later lands the same row; a read has nothing to park.
    if (method !== 'GET') {
      enqueue(`${BASE}${path}`, method, init?.body as string | undefined)
      throw new QueuedOfflineError()
    }
    throw cause
  }

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = Array.isArray(body) ? body.join(', ') : String(body)
    } catch {
      // Not every error carries a JSON body; the status text will do.
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export { ApiError, QueuedOfflineError }
