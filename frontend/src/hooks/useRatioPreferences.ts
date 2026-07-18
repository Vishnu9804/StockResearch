import { useCallback, useEffect, useState } from 'react'
import { useAppSelector } from '@/store/hooks'
import finscreenApi, { ratioPreferencesApi } from '@/services/finscreenApi'

export interface RatioDefinition {
  key: string
  label: string
  category: string
  format: 'percent' | 'number' | 'currency' | 'crore' | 'days'
}

/**
 * Loads the static ratio catalog once, plus the signed-in user's saved extra-ratio
 * selections (global — applies to every company page they view). Selections persist
 * server-side via /api/ratio-preferences so they carry across sessions/devices.
 */
export function useRatioPreferences() {
  const { isAuthenticated } = useAppSelector((state) => state.auth)
  const [catalog, setCatalog] = useState<RatioDefinition[]>([])
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      finscreenApi.fetchRatioCatalog().catch(() => ({ ratios: [] })),
      isAuthenticated ? ratioPreferencesApi.list().catch(() => ({ ratioKeys: [] })) : Promise.resolve({ ratioKeys: [] }),
    ]).then(([catalogRes, prefsRes]) => {
      if (cancelled) return
      setCatalog(catalogRes?.ratios ?? [])
      setSelectedKeys(prefsRes?.ratioKeys ?? [])
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [isAuthenticated])

  const addRatios = useCallback(async (keys: string[]) => {
    setSelectedKeys((prev) => Array.from(new Set([...prev, ...keys])))
    if (!isAuthenticated) return
    try {
      const res = await ratioPreferencesApi.add(keys)
      if (res?.ratioKeys) setSelectedKeys(res.ratioKeys)
    } catch (err) {
      console.error('[useRatioPreferences] Failed to save ratio selection:', err)
    }
  }, [isAuthenticated])

  const removeRatio = useCallback(async (key: string) => {
    setSelectedKeys((prev) => prev.filter((k) => k !== key))
    if (!isAuthenticated) return
    try {
      await ratioPreferencesApi.remove(key)
    } catch (err) {
      console.error('[useRatioPreferences] Failed to remove ratio:', err)
    }
  }, [isAuthenticated])

  return { catalog, selectedKeys, addRatios, removeRatio, loading }
}

export default useRatioPreferences
