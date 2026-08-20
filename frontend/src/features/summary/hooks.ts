import { useMutation } from '@tanstack/react-query'

/**
 * The summary is plain text, not JSON, so it bypasses the shared api helper.
 */
async function fetchSummary(date: string): Promise<string> {
  const res = await fetch(`/api/summary/${date}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Export fehlgeschlagen (HTTP ${res.status})`)
  return res.text()
}

export function useDaySummary() {
  return useMutation({ mutationFn: (date: string) => fetchSummary(date) })
}
