'use client'

import { useEffect, useState } from 'react'
import BusinessInfoSection from '@/components/credit-funding/BusinessInfoSection'
import SsnInputField from '@/components/credit-funding/SsnInputField'
import {
  CREDIT_GOAL_OPTIONS,
  CREDIT_PROVIDERS,
  FUNDING_TIMEFRAMES,
  requiresBusinessSection,
  type BusinessProfile,
  type ConsentData,
  type CreditProfile,
  type DocumentType,
} from '@/lib/credit-funding-types'
import { IDENTITY_DOCUMENTS, BUSINESS_DOCUMENTS } from '@/lib/credit-funding-document-steps'

const inputClass =
  'w-full py-2.5 px-3 bg-neutral-50 border border-brand-border rounded-lg text-sm text-brand-text outline-none focus:border-accent'
const labelClass = 'block text-xs font-semibold text-brand-muted mb-1'

type DraftFormState = {
  fullName: string
  dateOfBirth: string
  ssn: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  creditProfile: CreditProfile
  selectedCreditProvider: string
  providerUsername: string
  providerPassword: string
  experianEmail: string
  experianPassword: string
  cfpbEmail: string
  cfpbPassword: string
  primaryCreditGoalsText: string
  creditGoals: string[]
  fundingAmount: string
  fundingUse: string
  ownsBusiness: boolean
  businessName: string
  fundingTimeframe: string
  goalsNotes: string
  businessProfile: BusinessProfile
  consent: ConsentData
  typedSignature: string
  signatureDate: string
}

const emptyForm = (): DraftFormState => ({
  fullName: '',
  dateOfBirth: '',
  ssn: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  creditProfile: {},
  selectedCreditProvider: '',
  providerUsername: '',
  providerPassword: '',
  experianEmail: '',
  experianPassword: '',
  cfpbEmail: '',
  cfpbPassword: '',
  primaryCreditGoalsText: '',
  creditGoals: [],
  fundingAmount: '',
  fundingUse: '',
  ownsBusiness: false,
  businessName: '',
  fundingTimeframe: '',
  goalsNotes: '',
  businessProfile: {},
  consent: { accurateInfo: false, authorizeReview: false, agreeTerms: false },
  typedSignature: '',
  signatureDate: new Date().toISOString().slice(0, 10),
})

type UploadedDoc = {
  id: string
  document_type: string
  file_name: string
  file_size: number
  scan_status: string
}

type Props = {
  draftId: string | null
  onClose: () => void
  onSaved: (id: string) => void
  onFinalized: (id: string) => void
}

function mapDraftToForm(draft: Record<string, unknown>): DraftFormState {
  const base = emptyForm()
  return {
    ...base,
    fullName: String(draft.full_name || ''),
    dateOfBirth: String(draft.date_of_birth || ''),
    ssn: String(draft.ssn || ''),
    email: String(draft.email || ''),
    phone: String(draft.phone || ''),
    address: String(draft.address || ''),
    city: String(draft.city || ''),
    state: String(draft.state || ''),
    zipCode: String(draft.zip_code || ''),
    creditProfile: (draft.credit_profile as CreditProfile) || {},
    selectedCreditProvider:
      draft.selected_credit_provider && draft.selected_credit_provider !== 'Pending'
        ? String(draft.selected_credit_provider)
        : '',
    providerUsername: String(draft.provider_username || ''),
    providerPassword: '',
    experianEmail: String(draft.experian_email || ''),
    experianPassword: '',
    cfpbEmail: String(draft.cfpb_email || ''),
    cfpbPassword: '',
    primaryCreditGoalsText: String(draft.primary_credit_goals_text || ''),
    creditGoals: Array.isArray(draft.credit_goals) ? (draft.credit_goals as string[]) : [],
    fundingAmount: String(draft.funding_amount || ''),
    fundingUse: String(draft.funding_use || ''),
    ownsBusiness: Boolean(draft.owns_business),
    businessName: String(draft.business_name || ''),
    fundingTimeframe: String(draft.funding_timeframe || ''),
    goalsNotes: String(draft.goals_notes || ''),
    businessProfile: (draft.business_profile as BusinessProfile) || {},
    consent: (draft.consent_data as ConsentData) || base.consent,
    typedSignature: '',
    signatureDate: String(draft.signature_date || base.signatureDate),
  }
}

export default function StaffDraftEditor({ draftId, onClose, onSaved, onFinalized }: Props) {
  const [form, setForm] = useState<DraftFormState>(emptyForm)
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [applicationId, setApplicationId] = useState('')
  const [editable, setEditable] = useState(true)
  const [status, setStatus] = useState('draft')
  const [loading, setLoading] = useState(Boolean(draftId))
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [personalMessage, setPersonalMessage] = useState('')
  const [secretsOnFile, setSecretsOnFile] = useState({
    ssnSet: false,
    dateOfBirthSet: false,
    providerUsernameSet: false,
    providerPasswordSet: false,
    experianEmailSet: false,
    experianPasswordSet: false,
    cfpbEmailSet: false,
    cfpbPasswordSet: false,
    typedSignatureSet: false,
  })

  const currentId = draftId
  const showBusiness = requiresBusinessSection(form.ownsBusiness, form.fundingUse, form.creditProfile)

  useEffect(() => {
    if (!draftId) {
      setForm(emptyForm())
      setDocuments([])
      setApplicationId('')
      setEditable(true)
      setStatus('draft')
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const r = await fetch(`/api/admin/credit-funding/drafts/${draftId}`)
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data.error || 'Failed to load draft')
        if (cancelled) return
        setApplicationId(data.application_id || '')
        setStatus(data.status || 'draft')
        setEditable(Boolean(data.editable))
        setDocuments(data.documents || [])
        if (data.draft) {
          setForm(mapDraftToForm(data.draft))
          setSecretsOnFile({
            ssnSet: Boolean(data.draft.ssnSet),
            dateOfBirthSet: Boolean(data.draft.dateOfBirthSet),
            providerUsernameSet: Boolean(data.draft.providerUsernameSet),
            providerPasswordSet: Boolean(data.draft.providerPasswordSet),
            experianEmailSet: Boolean(data.draft.experianEmailSet),
            experianPasswordSet: Boolean(data.draft.experianPasswordSet),
            cfpbEmailSet: Boolean(data.draft.cfpbEmailSet),
            cfpbPasswordSet: Boolean(data.draft.cfpbPasswordSet),
            typedSignatureSet: Boolean(data.draft.typedSignatureSet),
          })
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load draft')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [draftId])

  const update = <K extends keyof DraftFormState>(key: K, value: DraftFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const buildBody = () => ({
    fullName: form.fullName,
    dateOfBirth: form.dateOfBirth,
    ssn: form.ssn,
    email: form.email,
    phone: form.phone,
    address: form.address,
    city: form.city,
    state: form.state,
    zipCode: form.zipCode,
    creditProfile: form.creditProfile,
    selectedCreditProvider: form.selectedCreditProvider,
    providerUsername: form.providerUsername,
    providerPassword: form.providerPassword,
    experianEmail: form.experianEmail,
    experianPassword: form.experianPassword,
    cfpbEmail: form.cfpbEmail,
    cfpbPassword: form.cfpbPassword,
    primaryCreditGoalsText: form.primaryCreditGoalsText,
    creditGoals: form.creditGoals,
    fundingAmount: form.fundingAmount,
    fundingUse: form.fundingUse,
    ownsBusiness: form.ownsBusiness,
    businessName: form.businessName,
    fundingTimeframe: form.fundingTimeframe,
    goalsNotes: form.goalsNotes,
    businessProfile: form.businessProfile,
    consent: form.consent,
    typedSignature: form.typedSignature,
    signatureDate: form.signatureDate,
    ...secretsOnFile,
  })

  const saveDraft = async () => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const body = buildBody()
      const r = await fetch(
        currentId ? `/api/admin/credit-funding/drafts/${currentId}` : '/api/admin/credit-funding/drafts',
        {
          method: currentId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Save failed')
      setNotice(currentId ? 'Draft saved.' : 'Draft created.')
      setApplicationId(data.application_id || applicationId)
      setStatus(data.status || 'draft')
      setEditable(true)
      if (data.draft) setForm(mapDraftToForm(data.draft))
      if (data.draft) {
        setSecretsOnFile({
          ssnSet: Boolean(data.draft.ssnSet),
          dateOfBirthSet: Boolean(data.draft.dateOfBirthSet),
          providerUsernameSet: Boolean(data.draft.providerUsernameSet),
          providerPasswordSet: Boolean(data.draft.providerPasswordSet),
          experianEmailSet: Boolean(data.draft.experianEmailSet),
          experianPasswordSet: Boolean(data.draft.experianPasswordSet),
          cfpbEmailSet: Boolean(data.draft.cfpbEmailSet),
          cfpbPasswordSet: Boolean(data.draft.cfpbPasswordSet),
          typedSignatureSet: Boolean(data.draft.typedSignatureSet),
        })
      }
      onSaved(data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (action: string, extra?: Record<string, unknown>) => {
    if (!currentId) {
      setError('Save the draft first.')
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const r = await fetch(`/api/admin/credit-funding/drafts/${currentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...buildBody(), ...extra }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Action failed')

      if (action === 'finalize') {
        setNotice(data.message || 'Draft finalized.')
        onFinalized(data.id || currentId)
        return
      }
      if (action === 'send-finish-link') {
        setNotice(`Finish link emailed to ${data.email || form.email}.`)
        setStatus('invitation_pending')
        setEditable(false)
        onSaved(currentId)
        return
      }
      if (action === 'cancel-finish-link') {
        setNotice('Finish link cancelled. Draft is editable again.')
        setStatus('draft')
        setEditable(true)
        if (data.draft) setForm(mapDraftToForm(data.draft))
        if (data.draft) {
          setSecretsOnFile({
            ssnSet: Boolean(data.draft.ssnSet),
            dateOfBirthSet: Boolean(data.draft.dateOfBirthSet),
            providerUsernameSet: Boolean(data.draft.providerUsernameSet),
            providerPasswordSet: Boolean(data.draft.providerPasswordSet),
            experianEmailSet: Boolean(data.draft.experianEmailSet),
            experianPasswordSet: Boolean(data.draft.experianPasswordSet),
            cfpbEmailSet: Boolean(data.draft.cfpbEmailSet),
            cfpbPasswordSet: Boolean(data.draft.cfpbPasswordSet),
            typedSignatureSet: Boolean(data.draft.typedSignatureSet),
          })
        }
        onSaved(currentId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  const uploadDoc = async (documentType: DocumentType, file: File) => {
    if (!currentId) {
      setError('Save the draft before uploading documents.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('documentType', documentType)
      fd.append('file', file)
      const r = await fetch(`/api/admin/credit-funding/drafts/${currentId}/documents`, {
        method: 'POST',
        body: fd,
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Upload failed')
      setNotice(`Uploaded ${documentType.replace(/_/g, ' ')}.`)
      const refresh = await fetch(`/api/admin/credit-funding/drafts/${currentId}`)
      const refreshed = await refresh.json().catch(() => ({}))
      if (refresh.ok) setDocuments(refreshed.documents || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-brand-muted">Loading draft…</div>
  }

  return (
    <div className="bg-white border border-brand-border rounded-xl p-5 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand-text">
            {currentId ? 'Edit Draft Application' : 'New Draft Application'}
          </h2>
          <p className="text-sm text-brand-muted mt-1">
            Save incomplete applications and return later. Finalize when ready, or email the client to finish.
          </p>
          {applicationId && (
            <p className="text-xs font-semibold text-brand-text mt-2">
              {applicationId} · {status === 'draft' ? 'Draft' : 'Waiting on client'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50"
        >
          Close
        </button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>}
      {notice && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{notice}</div>}

      {!editable && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
          A finish link was sent to the client. Editing is locked until you cancel the link or they submit.
        </div>
      )}

      <fieldset disabled={!editable || saving} className="space-y-6 disabled:opacity-70">
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelClass}>Full legal name *</label>
            <input className={inputClass} value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input className={inputClass} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input className={inputClass} value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Date of birth {secretsOnFile.dateOfBirthSet ? '(on file)' : ''}</label>
            <input className={inputClass} type="date" value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>SSN {secretsOnFile.ssnSet ? '(on file — leave blank to keep)' : ''}</label>
            <SsnInputField value={form.ssn} onChange={(v) => update('ssn', v)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Address</label>
            <input className={inputClass} value={form.address} onChange={(e) => update('address', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input className={inputClass} value={form.city} onChange={(e) => update('city', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input className={inputClass} maxLength={2} value={form.state} onChange={(e) => update('state', e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className={labelClass}>ZIP</label>
            <input className={inputClass} value={form.zipCode} onChange={(e) => update('zipCode', e.target.value)} />
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Credit provider</label>
            <select className={inputClass} value={form.selectedCreditProvider} onChange={(e) => update('selectedCreditProvider', e.target.value)}>
              <option value="">Select…</option>
              {CREDIT_PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Provider username {secretsOnFile.providerUsernameSet ? '(on file)' : ''}</label>
            <input className={inputClass} value={form.providerUsername} onChange={(e) => update('providerUsername', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Provider password {secretsOnFile.providerPasswordSet ? '(leave blank to keep)' : ''}</label>
            <input className={inputClass} type="password" value={form.providerPassword} onChange={(e) => update('providerPassword', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Experian email</label>
            <input className={inputClass} value={form.experianEmail} onChange={(e) => update('experianEmail', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Experian password {secretsOnFile.experianPasswordSet ? '(leave blank to keep)' : ''}</label>
            <input className={inputClass} type="password" value={form.experianPassword} onChange={(e) => update('experianPassword', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>CFPB email</label>
            <input className={inputClass} value={form.cfpbEmail} onChange={(e) => update('cfpbEmail', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>CFPB password {secretsOnFile.cfpbPasswordSet ? '(leave blank to keep)' : ''}</label>
            <input className={inputClass} type="password" value={form.cfpbPassword} onChange={(e) => update('cfpbPassword', e.target.value)} />
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <label className={labelClass}>Primary credit goals</label>
            <textarea className={`${inputClass} min-h-[80px]`} value={form.primaryCreditGoalsText} onChange={(e) => update('primaryCreditGoalsText', e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {CREDIT_GOAL_OPTIONS.map((goal) => (
              <label key={goal} className="inline-flex items-center gap-1.5 text-xs text-brand-text border border-brand-border rounded-full px-3 py-1">
                <input
                  type="checkbox"
                  checked={form.creditGoals.includes(goal)}
                  onChange={() =>
                    update(
                      'creditGoals',
                      form.creditGoals.includes(goal)
                        ? form.creditGoals.filter((g) => g !== goal)
                        : [...form.creditGoals, goal]
                    )
                  }
                />
                {goal}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Funding amount</label>
              <input className={inputClass} value={form.fundingAmount} onChange={(e) => update('fundingAmount', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Funding use</label>
              <select className={inputClass} value={form.fundingUse} onChange={(e) => update('fundingUse', e.target.value)}>
                <option value="">Select…</option>
                <option value="Personal">Personal</option>
                <option value="Business">Business</option>
                <option value="Both">Both</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Timeframe</label>
              <select className={inputClass} value={form.fundingTimeframe} onChange={(e) => update('fundingTimeframe', e.target.value)}>
                <option value="">Select…</option>
                {FUNDING_TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-brand-text">
            <input type="checkbox" checked={form.ownsBusiness} onChange={(e) => update('ownsBusiness', e.target.checked)} />
            Owns a business
          </label>
          {form.ownsBusiness && (
            <div>
              <label className={labelClass}>Business name</label>
              <input className={inputClass} value={form.businessName} onChange={(e) => update('businessName', e.target.value)} />
            </div>
          )}
          <div>
            <label className={labelClass}>Notes</label>
            <textarea className={`${inputClass} min-h-[70px]`} value={form.goalsNotes} onChange={(e) => update('goalsNotes', e.target.value)} />
          </div>
        </section>

        {showBusiness && (
          <BusinessInfoSection
            profile={form.businessProfile}
            onChange={(bp) => update('businessProfile', bp)}
            errors={{}}
          />
        )}

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-brand-text">Documents</h3>
          <p className="text-xs text-brand-muted">Save the draft once before uploading. Required for finalize: photo ID and mail proof.</p>
          <ul className="space-y-2">
            {[...IDENTITY_DOCUMENTS, ...(showBusiness ? BUSINESS_DOCUMENTS : [])].map((doc) => {
              const existing = documents.filter((d) => d.document_type === doc.type)
              return (
                <li key={doc.type} className="flex flex-wrap items-center justify-between gap-2 border border-brand-border rounded-lg p-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-text">
                      {doc.label}{doc.required ? ' *' : ''}
                    </p>
                    {existing.length > 0 ? (
                      <p className="text-xs text-green-700">{existing.map((d) => d.file_name).join(', ')}</p>
                    ) : (
                      <p className="text-xs text-brand-muted">Not uploaded</p>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.txt,image/*,application/pdf"
                    disabled={!currentId || !editable}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadDoc(doc.type, file)
                      e.target.value = ''
                    }}
                  />
                </li>
              )
            })}
          </ul>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Typed signature {secretsOnFile.typedSignatureSet ? '(on file)' : ''}</label>
            <input className={inputClass} value={form.typedSignature} onChange={(e) => update('typedSignature', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Signature date</label>
            <input className={inputClass} type="date" value={form.signatureDate} onChange={(e) => update('signatureDate', e.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.consent.accurateInfo} onChange={(e) => update('consent', { ...form.consent, accurateInfo: e.target.checked })} />
            Accurate info
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.consent.authorizeReview} onChange={(e) => update('consent', { ...form.consent, authorizeReview: e.target.checked })} />
            Authorize review
          </label>
          <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.consent.agreeTerms} onChange={(e) => update('consent', { ...form.consent, agreeTerms: e.target.checked })} />
            Agree to terms / privacy
          </label>
        </section>
      </fieldset>

      <div className="space-y-3 border-t border-brand-border pt-4">
        {editable && (
          <div>
            <label className={labelClass}>Message for client finish email (optional)</label>
            <textarea
              className={`${inputClass} min-h-[70px]`}
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              placeholder="Sunday Harmony started your application…"
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {editable && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDraft()}
              className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : currentId ? 'Save Draft' : 'Create Draft'}
            </button>
          )}
          {editable && currentId && (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void runAction('finalize')}
                className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 disabled:opacity-50"
              >
                Finalize into System
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void runAction('send-finish-link', { personal_message: personalMessage })}
                className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 disabled:opacity-50"
              >
                Email Client to Finish
              </button>
            </>
          )}
          {!editable && status === 'invitation_pending' && currentId && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void runAction('cancel-finish-link')}
              className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel Finish Link
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
