'use client'

import { useCallback, useEffect, useState } from 'react'

export interface AdminClientRow {
  id: string
  name: string
  business: string
  email?: string
  status?: string
  [key: string]: unknown
}

let cachedClients: AdminClientRow[] | null = null
let inflight: Promise<AdminClientRow[]> | null = null

async function fetchAdminClients(): Promise<AdminClientRow[]> {
  if (cachedClients) return cachedClients
  if (inflight) return inflight
  inflight = fetch('/api/admin/clients')
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to load clients')
      const data = await res.json()
      cachedClients = Array.isArray(data) ? data : []
      return cachedClients
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useAdminClients() {
  const [clients, setClients] = useState<AdminClientRow[]>(cachedClients || [])
  const [loading, setLoading] = useState(!cachedClients)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    cachedClients = null
    setLoading(true)
    setError('')
    try {
      const list = await fetchAdminClients()
      setClients(list)
    } catch {
      setError('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (cachedClients) {
      setClients(cachedClients)
      setLoading(false)
      return
    }
    refresh()
  }, [refresh])

  return { clients, loading, error, refresh }
}
