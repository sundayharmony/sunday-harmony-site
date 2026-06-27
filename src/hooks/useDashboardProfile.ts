'use client'

import { useCallback, useEffect, useState } from 'react'

export interface DashboardProfile {
  id: string
  name: string
  business: string
  email: string
  [key: string]: unknown
}

let cached: DashboardProfile | null = null
let inflight: Promise<DashboardProfile> | null = null

export function useDashboardProfile() {
  const [profile, setProfile] = useState<DashboardProfile | null>(cached)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    cached = null
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/profile')
      if (!res.ok) throw new Error('Failed')
      const data = (await res.json()) as DashboardProfile
      cached = data
      setProfile(data)
    } catch {
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cached) {
      setProfile(cached)
      setLoading(false)
      return
    }
    if (!inflight) {
      inflight = fetch('/api/dashboard/profile')
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed')
          const data = (await res.json()) as DashboardProfile
          cached = data
          return data
        })
        .finally(() => {
          inflight = null
        })
    }
    inflight
      .then((data) => setProfile(data))
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  return { profile, loading, error, refresh }
}
