'use client'

import { useCallback, useRef, useState } from 'react'
import type { DocumentType } from '@/lib/credit-funding-types'
import type { StagedCreditFundingFile } from '@/lib/credit-funding-storage'

export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error'

export interface StagedDocumentState {
  status: UploadStatus
  fileName?: string
  fileSize?: number
  staged?: StagedCreditFundingFile
  error?: string
}

export function useStagedDocumentUploads() {
  const [uploads, setUploads] = useState<Record<string, StagedDocumentState>>({})
  const sessionRef = useRef<{ sessionId: string; uploadToken: string } | null>(null)

  const ensureSession = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current
    const res = await fetch('/api/credit-funding/session', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.sessionId || !data.uploadToken) {
      throw new Error(data.error || 'Could not start secure upload session')
    }
    sessionRef.current = { sessionId: data.sessionId, uploadToken: data.uploadToken }
    return sessionRef.current
  }, [])

  const uploadDocument = useCallback(
    async (documentType: DocumentType, file: File) => {
      setUploads((prev) => ({
        ...prev,
        [documentType]: { status: 'uploading', fileName: file.name, fileSize: file.size },
      }))

      try {
        const session = await ensureSession()
        const fd = new FormData()
        fd.append('sessionId', session.sessionId)
        fd.append('uploadToken', session.uploadToken)
        fd.append('documentType', documentType)
        fd.append('file', file)

        const res = await fetch('/api/credit-funding/stage', { method: 'POST', body: fd })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || 'Upload failed')
        }

        setUploads((prev) => ({
          ...prev,
          [documentType]: {
            status: 'uploaded',
            fileName: file.name,
            fileSize: file.size,
            staged: data.file as StagedCreditFundingFile,
          },
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setUploads((prev) => ({
          ...prev,
          [documentType]: {
            status: 'error',
            fileName: file.name,
            fileSize: file.size,
            error: message,
          },
        }))
        throw err
      }
    },
    [ensureSession]
  )

  const removeDocument = useCallback((documentType: DocumentType) => {
    setUploads((prev) => {
      const next = { ...prev }
      delete next[documentType]
      return next
    })
  }, [])

  const getStagedFiles = useCallback((): StagedCreditFundingFile[] => {
    return Object.values(uploads)
      .map((u) => u.staged)
      .filter((s): s is StagedCreditFundingFile => Boolean(s))
  }, [uploads])

  const getSession = useCallback(() => sessionRef.current, [])

  const isRequiredUploaded = useCallback(
    (requiredTypes: DocumentType[]) =>
      requiredTypes.every((t) => uploads[t]?.status === 'uploaded'),
    [uploads]
  )

  const hasUploadInProgress = useCallback(
    () => Object.values(uploads).some((u) => u.status === 'uploading'),
    [uploads]
  )

  return {
    uploads,
    uploadDocument,
    removeDocument,
    getStagedFiles,
    getSession,
    isRequiredUploaded,
    hasUploadInProgress,
  }
}
