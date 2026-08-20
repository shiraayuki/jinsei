import { useMutation } from '@tanstack/react-query'

export type SummaryScope = 'day' | 'week'

/** The summary is plain text, not JSON, so it bypasses the shared api helper. */
async function fetchSummary(scope: SummaryScope, date: string): Promise<string> {
  const path = scope === 'week' ? `/api/summary/week/${date}` : `/api/summary/${date}`
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) throw new Error(`Export fehlgeschlagen (HTTP ${res.status})`)
  return res.text()
}

export function useDaySummary() {
  return useMutation({
    mutationFn: ({ scope, date }: { scope: SummaryScope; date: string }) => fetchSummary(scope, date),
  })
}
