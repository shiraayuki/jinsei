import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'

/**
 * The week's energy numbers, as the server worked them out.
 *
 * Deliberately not computed here from whatever range the chart happens to be
 * showing: the target moved when the range switch did, and the button then
 * wrote a different figure than the weekly job would have. One window, on the
 * server, and everything reads it.
 */
export interface EnergyTarget {
  /** Maintenance, measured. Null until there is enough logged for it to mean anything. */
  tdee: number | null
  meanKcal: number | null
  ratePerWeek: number | null
  anchorWeightKg: number | null
  weeklyKg: number | null
  targetKcal: number | null
  kcalDays: number
  weighIns: number
  ratePercent: number | null
  minKcalDays: number
  minWeighIns: number
  windowDays: number
  adopted: boolean
  autoKcalGoal: boolean
  kcalGoalUpdatedAt: string | null
}

const KEY = 'energy-target'

export function useEnergyTarget() {
  return useQuery({ queryKey: [KEY], queryFn: () => api.get<EnergyTarget>('/energy/target') })
}

export function useApplyEnergyTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<EnergyTarget>('/energy/target/apply', {}),
    // The goal itself lives on the user, which is context rather than a
    // query — the caller refreshes that, since it is the one holding it.
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
