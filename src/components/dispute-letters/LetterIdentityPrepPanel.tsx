'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import LetterIdentityCropModal from '@/components/credit-funding/LetterIdentityCropModal'
import { getCreditFundingFileValidationError } from '@/lib/credit-funding-types'

export type LetterIdentityPrepItem = {
  key: string
  label: string
  uploadType: string
  defaultRequestNote: string
  present: boolean
  documents: {
    id: string
    file_name: string
    mime_type?: string | null
    file_type?: string | null
    letterCopy: boolean
    canCrop: boolean
    signedUrl?: string
  }[]
}

export type LetterIdentityPrepState = {
  linked: boolean
  applicationId: string | null
  items: LetterIdentityPrepItem[]
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg'

export default function LetterIdentityPrepPanel({
  sessionId,
  onReadyChange,
}: {
  sessionId: string
  onReadyChange?: (ready: boolean) => void
}) {
  const [state, setState] = useState<LetterIdentityPrepState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const readyRef = useRef(onReadyChange)
  readyRef.current = onReadyChange
  const [cropDoc, setCropDoc] = useState<{
    itemKey: string
    id: string
    title: string
    fileName: string
    imageUrl?: string
  } | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/dispute-letters/${encodeURIComponent(sessionId)}/letter-identity`)
      const data = (await res.json().catch(() => ({}))) as LetterIdentityPrepState & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Failed to load letter documents')
      setState(data)
      setNotes((prev) => {
        const next = { ...prev }
        for (const item of data.items || []) {
          if (next[item.key] == null) next[item.key] = item.defaultRequestNote
        }
        return next
      })
      const ready = !data.linked || (data.items || []).every((item) => item.present)
      readyRef.current?.(ready)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load letter documents')
      readyRef.current?.(false)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void load()
  }, [load])

  const missing = (state?.items || []).filter((item) => !item.present)

  const uploadFile = async (item: LetterIdentityPrepItem, file: File, replaceDocId?: string) => {
    if (!state?.applicationId) return
    const validation = getCreditFundingFileValidationError(file)
    if (validation) {
      setError(validation)
      return
    }
    setBusyKey(item.key)
    setError('')
    try {
      if (replaceDocId) {
        const body = new FormData()
        body.append('file', file)
        const res = await fetch(
          `/api/admin/credit-funding/documents/${encodeURIComponent(replaceDocId)}?applicationId=${encodeURIComponent(state.applicationId)}`,
          { method: 'PUT', body }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to save letter copy')
      } else {
        const body = new FormData()
        body.append('documentType', item.uploadType)
        body.append('file', file)
        const res = await fetch(`/api/admin/credit-funding/${encodeURIComponent(state.applicationId)}/documents`, {
          method: 'POST',
          body,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to upload document')
      }
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusyKey(null)
      setCropDoc(null)
    }
  }

  const sendRequest = async () => {
    if (!missing.length) return
    setBusyKey('request')
    setError('')
    try {
      const res = await fetch(`/api/admin/dispute-letters/${encodeURIComponent(sessionId)}/letter-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: missing.map((item) => ({
            key: item.key,
            notes: notes[item.key] || item.defaultRequestNote,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to send request')
      setNotice('Request email sent. The client can upload in their portal.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request')
    } finally {
      setBusyKey(null)
    }
  }

  if (loading && !state) {
    return <p className="text-sm text-brand-dim">Checking letter documents…</p>
  }
  if (state && !state.linked) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Link this report to a Credit &amp; Funding application to attach Government Photo ID, Proof of
        Residence, and Social Security Card to the letters.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-brand-border bg-white p-6 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold text-brand-text">Documents on the letters</h3>
        <p className="mt-1 text-sm text-brand-dim">
          Letters need a Government Photo ID, Proof of Residence, and Social Security Card. Crop the
          original client upload if you only need a tighter photo — the original stays on file.
        </p>
      </div>

      {(state?.items || []).map((item) => (
        <div key={item.key} className="rounded-lg border border-brand-border p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-brand-text">{item.label}</p>
            <span
              className={`text-xs font-semibold ${item.present ? 'text-green-700' : 'text-amber-800'}`}
            >
              {item.present ? 'Ready' : 'Missing'}
            </span>
          </div>

          {item.documents.length > 0 && (
            <ul className="space-y-1">
              {item.documents.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-brand-muted truncate max-w-[14rem]">{doc.file_name}</span>
                  <span className="text-brand-dim">
                    {doc.letterCopy ? 'Used for letters' : 'Original client upload'}
                  </span>
                  {doc.signedUrl && (
                    <a
                      href={doc.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-accent hover:underline"
                    >
                      View
                    </a>
                  )}
                  {doc.canCrop && state?.applicationId && (
                    <button
                      type="button"
                      className="font-semibold text-accent hover:underline"
                      onClick={() =>
                        setCropDoc({
                          itemKey: item.key,
                          id: doc.id,
                          title: item.label,
                          fileName: doc.file_name,
                          imageUrl: doc.signedUrl,
                        })
                      }
                    >
                      Crop for letters
                    </button>
                  )}
                  <label className="font-semibold text-accent hover:underline cursor-pointer">
                    {busyKey === item.key ? 'Saving…' : 'Use for letters'}
                    <input
                      type="file"
                      className="sr-only"
                      accept={ACCEPT}
                      disabled={busyKey === item.key}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void uploadFile(item, file, doc.id)
                      }}
                    />
                  </label>
                </li>
              ))}
            </ul>
          )}

          {!item.present && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-accent hover:underline cursor-pointer w-fit">
                {busyKey === item.key ? 'Uploading…' : 'Add file now'}
                <input
                  type="file"
                  className="sr-only"
                  accept={ACCEPT}
                  disabled={busyKey === item.key}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void uploadFile(item, file)
                  }}
                />
              </label>
              <label className="block text-xs text-brand-muted">
                Note for the client (optional)
                <textarea
                  className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 text-sm min-h-[64px] text-brand-text"
                  value={notes[item.key] || ''}
                  onChange={(event) => setNotes((prev) => ({ ...prev, [item.key]: event.target.value }))}
                />
              </label>
            </div>
          )}
        </div>
      ))}

      {missing.length > 0 && (
        <button
          type="button"
          onClick={() => void sendRequest()}
          disabled={busyKey === 'request'}
          className="rounded-lg border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-neutral-50 disabled:opacity-50"
        >
          {busyKey === 'request' ? 'Sending…' : `Email request for ${missing.map((item) => item.label).join(', ')}`}
        </button>
      )}

      {notice && <p className="text-sm text-green-700">{notice}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {cropDoc && state?.applicationId && (
        <LetterIdentityCropModal
          title={cropDoc.title}
          fileName={cropDoc.fileName}
          documentId={cropDoc.id}
          applicationId={state.applicationId}
          imageUrl={cropDoc.imageUrl}
          saving={busyKey === cropDoc.itemKey}
          onCancel={() => setCropDoc(null)}
          onSave={async (file) => {
            const item = state?.items.find((row) => row.key === cropDoc.itemKey)
            if (!item) return
            await uploadFile(item, file, cropDoc.id)
            setCropDoc(null)
          }}
        />
      )}
    </div>
  )
}
