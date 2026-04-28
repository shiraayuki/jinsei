import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../lib/api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => {
        if (err instanceof ApiError && err.status < 500) return false
        return count < 2
      },
      staleTime: 1000 * 30,
    },
  },
})
