import { useSyncExternalStore } from 'react'
import {
  isFullScreenLoaderVisible,
  subscribeToFullScreenLoader,
} from '@/shared/api/full-screen-loader-store'

export const useApiFullScreenLoader = () =>
  useSyncExternalStore(subscribeToFullScreenLoader, isFullScreenLoaderVisible, () => false)
