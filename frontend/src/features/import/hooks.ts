import { useMutation, useQuery } from '@tanstack/react-query'
import { importApi, type ScreenshotRequest } from './api'

export function useImportStatus() {
  return useQuery({
    queryKey: ['import', 'status'],
    queryFn: () => importApi.status(),
    staleTime: Infinity,
  })
}

export function useScreenshotImport<F>() {
  return useMutation({
    mutationFn: (req: ScreenshotRequest) => importApi.screenshot<F>(req),
  })
}
