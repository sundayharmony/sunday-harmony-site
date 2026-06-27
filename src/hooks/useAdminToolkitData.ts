'use client'

import { useCallback, useEffect, useState } from 'react'

export type AdminToolkitKey = 'research_tasks' | 'roadmap_tasks' | 'positioning_canvas'

type ToolkitData = Record<string, unknown>

let cache: Record<AdminToolkitKey, ToolkitData | null> = {
  research_tasks: null,
  roadmap_tasks: null,
  positioning_canvas: null,
}

export function useAdminToolkitData(key: AdminToolkitKey) {
  const [data, setData] = useState<ToolkitData | null>(cache[key])
  const [loading, setLoading] = useState(!cache[key])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/data')
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as Record<string, unknown>
      const slice = (json[key] as ToolkitData) || {}
      cache[key] = slice
      setData(slice)
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [key])

  const save = useCallback(
    async (updates: ToolkitData) => {
      setSaving(true)
      setError('')
      try {
        const res = await fetch('/api/admin/data', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: updates }),
        })
        if (!res.ok) throw new Error('Failed to save')
        const json = (await res.json()) as Record<string, unknown>
        const slice = (json[key] as ToolkitData) || updates
        cache[key] = slice
        setData(slice)
      } catch {
        setError('Failed to save')
        throw new Error('save failed')
      } finally {
        setSaving(false)
      }
    },
    [key]
  )

  useEffect(() => {
    if (cache[key]) {
      setData(cache[key])
      setLoading(false)
      return
    }
    load()
  }, [key, load])

  return { data, loading, error, saving, load, save }
}
