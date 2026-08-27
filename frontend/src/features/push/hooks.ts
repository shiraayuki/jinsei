import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { subscribeThisDevice, unsubscribeThisDevice, type DeviceSubscription } from '../../lib/push'

export interface PushConfig {
  /** Whether the server holds a VAPID pair at all. Without one nothing can be sent. */
  configured: boolean
  publicKey: string | null
  devices: number
}

const KEY = 'push-config'

export function usePushConfig() {
  return useQuery({ queryKey: [KEY], queryFn: () => api.get<PushConfig>('/push/config') })
}

export function useSubscribePush() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (publicKey: string) => {
      const device: DeviceSubscription = await subscribeThisDevice(publicKey)
      await api.post('/push/subscription', device, { queueOffline: false })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useUnsubscribePush() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeThisDevice()
      // The browser's own subscription is gone either way; the row only
      // matters so the server stops sending into a void.
      if (endpoint) await api.delete(`/push/subscription?endpoint=${encodeURIComponent(endpoint)}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useTestPush() {
  return useMutation({ mutationFn: () => api.post('/push/test', {}, { queueOffline: false }) })
}
