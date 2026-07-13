import { useQuery } from '@tanstack/react-query'

import { getFlashConfigRecord } from '@/flash'
import { queryClient, writeCache } from '@/lib/query-client'
import type { FlashConfigRecord } from '@/types/flash'

// One shared cache for the whole profile config record (`GET /api/config`).
// Every settings surface (MCP, model, config) reads and writes through this key
// so a save in one shows in the others, and revisiting a tab paints the cache
// instead of blanking on a fresh fetch.
//
// Distinct from session/hooks/use-flash-config.ts, which is side-effecting —
// it pushes personality/cwd/voice/… into the session stores for live chat.
export const HERMES_CONFIG_KEY = ['flash-config-record'] as const

// staleTime 0 → serve cache instantly, background-revalidate on every mount.
export const useFlashConfigRecord = () =>
  useQuery({ queryKey: HERMES_CONFIG_KEY, queryFn: getFlashConfigRecord, staleTime: 0 })

export const setFlashConfigCache = writeCache<FlashConfigRecord>(HERMES_CONFIG_KEY)

export const invalidateFlashConfig = () => queryClient.invalidateQueries({ queryKey: HERMES_CONFIG_KEY })
