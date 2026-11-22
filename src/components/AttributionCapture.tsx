'use client'

import { useEffect } from 'react'
import { captureFirstTouch } from '@/lib/lead-attribution'

export default function AttributionCapture() {
  useEffect(() => {
    captureFirstTouch()
  }, [])
  return null
}
