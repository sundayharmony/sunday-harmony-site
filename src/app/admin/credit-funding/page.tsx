'use client'

import { useState, useEffect, useMemo, Suspense, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import StatusBadge from '@/components/ui/StatusBadge'
import AdminApplicationWorkflow, {
  type WorkflowStepPayload,
} from '@/components/credit-funding/AdminApplicationWorkflow'
import CreditExpertsPanel from '@/components/credit-funding/CreditExpertsPanel'
import CreditIntelligencePanel from '@/components/credit-funding/CreditIntelligencePanel'
import CreditRepairBillingPanel from '@/components/billing/CreditRepairBillingPanel'
import StaffFundingScoresEditor from '@/components/credit-funding/StaffFundingScoresEditor'
import StaffDraftEditor from '@/components/credit-funding/StaffDraftEditor'
import LetterIdentityCropModal from '@/components/credit-funding/LetterIdentityCropModal'
import {
  APPLICATION_STATUSES,
  DOCUMENT_LABELS,
  DOCUMENT_TYPES,
  STATUS_LABELS,
  compareCreditFundingApplicationsByStatus,
  documentDisplayLabel,
  establishedMonthLabel,
  getCreditFundingFileValidationError,
  isLetterWorkingCopyPath,
  needsFundingWorkflow,
  type ApplicationStatus,
  type FundingScores,
} from '@/lib/credit-funding-types'
import { formatSsnFull } from '@/lib/ssn-utils'
import { applicationIsWaiting } from '@/lib/people'
import { parseDisputeLetterStep } from '@/lib/dispute-letters/workflow'
import {
  countUnreadApplicantMessages,
  formatUnreadBadgeCount,
  getCfMessageLastReadAt,
  markCfMessagesRead,
} from '@/lib/credit-funding-message-alerts'

interface ApplicationListItem {
  id: string
  application_id: string
  full_name: string
  email: string
  phone: string
  service_type?: string
  status: string
  assigned_specialist?: string
  assigned_expert_name?: string
  draft_source?: string | null
  created_at: string
  updated_at: string
}

interface ApplicationDetail {
  id: string
  application_id: string
  full_name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip_code: string
  date_of_birth?: string
  ssn?: string
  credit_goals: string[]
  funding_goals: string
  selected_credit_provider: string
  provider_username?: string
  provider_password?: string
  experian_email?: string
  experian_password?: string
  experian_security_answer?: string
  experian_pin?: string
  cfpb_email?: string
  cfpb_password?: string
  lead_id?: string | null
  credit_profile?: Record<string, unknown>
  primary_credit_goals_text?: string
  funding_amount?: string
  funding_use?: string
  funding_timeframe?: string
  goals_notes?: string
  referred_by?: string | null
  owns_business?: boolean
  business_name?: string
  invite_expires_at?: string
  invite_personal_message?: string
  business_profile?: Record<string, unknown>
  consent_data?: Record<string, boolean>
  typed_signature?: string
  signature_date?: string
  client_id?: string | null
  status: ApplicationStatus
  service_type?: string
  assigned_specialist?: string
  assigned_expert_name?: string
  internal_notes?: string
  client_notes?: string
  next_steps?: string
  funding_scores?: FundingScores
  created_at: string
  updated_at: string
}

interface DocumentItem {
  id: string
  document_type: string
  file_name: string
  file_size: number
  scan_status: string
  signedUrl?: string
  storage_path?: string
  mime_type?: string
  file_type?: string
  created_at?: string
}

interface MessageItem {
  id: string
  from_role: string
  from_name: string
  text: string
  created_at: string
}

interface DocRequest {
  id: string
  document_type: string
  label: string
  status: string
  notes?: string
}

type SensitiveRevealField =
  | 'date_of_birth'
  | 'ssn'
  | 'provider_username'
  | 'provider_password'
  | 'experian_email'
  | 'experian_password'
  | 'experian_security_answer'
  | 'experian_pin'
  | 'cfpb_email'
  | 'cfpb_password'
  | 'typed_signature'
  | 'monthly_gross_income'
  | 'annual_income'
  | 'business_ein'

const DOC_LABELS_MAP: Record<string, string> = { ...DOCUMENT_LABELS }
const MASKED_VALUE = '••••••••'

function formatListDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  })
}

function ClientCard({
  app,
  selected,
  expertName,
  onSelect,
}: {
  app: ApplicationListItem
  selected: boolean
  expertName: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full overflow-hidden rounded-2xl bg-white text-left shadow-[0_12px_28px_-18px_rgba(10,10,10,0.55)] ${
        selected ? 'ring-2 ring-accent' : ''
      }`}
    >
      <div className="flex">
        <span className="w-[3px] shrink-0 bg-accent" aria-hidden />
        <div className="min-w-0 flex-1 px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-text">{app.full_name}</p>
              <p className="mt-0.5 truncate text-xs text-brand-muted">{app.email}</p>
            </div>
            <StatusBadge status={app.status} />
          </div>
          <p className="mt-2 text-xs text-brand-dim">
            {expertName}
            {app.updated_at ? ` · Updated ${formatListDate(app.updated_at)}` : ''}
          </p>
          {app.status === 'draft' && (
            <p className="mt-1 text-[10px] text-brand-muted">Saved · incomplete</p>
          )}
          {app.status === 'invitation_pending' && app.draft_source === 'staff_manual' && (
            <p className="mt-1 text-[10px] text-brand-muted">Client finishing draft</p>
          )}
        </div>
      </div>
    </button>
  )
}

function yesNo(value?: boolean | null) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return '—'
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  if (value == null || value === '') return null
  return (
    <div>
      <p className="text-xs font-semibold text-brand-dim uppercase mb-0.5">{label}</p>
      <p className="text-brand-text whitespace-pre-wrap break-words">{value}</p>
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6 p-4 bg-neutral-50 rounded-xl border border-brand-border">
      <h3 className="text-sm font-bold text-brand-text mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">{children}</div>
    </div>
  )
}

function CreditFundingAdminContent() {
  const searchParams = useSearchParams()
  const [applications, setApplications] = useState<ApplicationListItem[]>([])
  const [selected, setSelected] = useState<ApplicationDetail | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [history, setHistory] = useState<{ status: ApplicationStatus; created_at: string; notes?: string; staff_email?: string }[]>([])
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [docRequests, setDocRequests] = useState<DocRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'intake' | 'intelligence' | 'funding' | 'messages'>('overview')
  const [messagesLastReadAt, setMessagesLastReadAt] = useState<string | null>(null)
  const [newMsg, setNewMsg] = useState('')
  const [editFields, setEditFields] = useState({
    assigned_specialist: '',
    internal_notes: '',
    client_notes: '',
    next_steps: '',
    status_notes: '',
  })
  const [fundingScores, setFundingScores] = useState<FundingScores>({})
  const [docReqType, setDocReqType] = useState('')
  const [docReqLabel, setDocReqLabel] = useState('')
  const [docReqNotes, setDocReqNotes] = useState('')
  const [cropDoc, setCropDoc] = useState<DocumentItem | null>(null)
  const [listPanelOpen, setListPanelOpen] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showDraftEditor, setShowDraftEditor] = useState(false)
  const [draftEditorId, setDraftEditorId] = useState<string | null>(null)
  const [draftEditorMode, setDraftEditorMode] = useState<'draft' | 'admin-intake'>('draft')
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState('')
  const [experts, setExperts] = useState<{ id: string; name: string; email: string }[]>([])
  const [expertsLoaded, setExpertsLoaded] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    personal_message: '',
  })
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteNotice, setInviteNotice] = useState('')
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null)
  const [downloadingIntake, setDownloadingIntake] = useState(false)
  const [revealingField, setRevealingField] = useState<SensitiveRevealField | null>(null)
  const [revealFieldError, setRevealFieldError] = useState<{ field: SensitiveRevealField; message: string } | null>(
    null
  )
  const [referral, setReferral] = useState<{
    referralId: string
    code: string | null
    referrerName: string
    referrerClientId: string | null
    status: string
  } | null>(null)

  const selectApplication = (id: string) => {
    const listed = applications.find((a) => a.id === id)
    if (listed?.status === 'draft' || (listed?.status === 'invitation_pending' && listed.draft_source === 'staff_manual')) {
      setSelected(null)
      setDraftEditorMode('draft')
      setDraftEditorId(id)
      setShowDraftEditor(true)
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
        setListPanelOpen(false)
      }
      return
    }
    setShowDraftEditor(false)
    setDraftEditorId(null)
    setDraftEditorMode('draft')
    loadDetail(id, { resetTab: true })
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setListPanelOpen(false)
    }
  }

  const openAdminIntakeEditor = (applicationId: string) => {
    // Admins and assigned credit experts may correct submitted intake answers.
    if (!(isAdmin || role === 'credit_manager')) return
    setDraftEditorMode('admin-intake')
    setDraftEditorId(applicationId)
    setShowDraftEditor(true)
    setInviteNotice('')
    setError('')
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      setListPanelOpen(false)
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const sessionRes = await fetch('/api/auth/session')
        if (!sessionRes.ok) return
        const data = await sessionRes.json()
        const nextRole = data?.user?.role || ''
        setRole(nextRole)
        setIsAdmin(data?.user?.role === 'admin')
        if (data?.user?.role === 'admin') {
          const expertsRes = await fetch('/api/admin/staff-users')
          if (expertsRes.ok) {
            const rows = await expertsRes.json()
            if (Array.isArray(rows)) {
              setExperts(
                rows
                  .map((row: { id?: string; name?: string; email?: string }) => ({
                    id: String(row?.id || ''),
                    name: String(row?.name || '').trim() || String(row?.email || ''),
                    email: String(row?.email || ''),
                  }))
                  .filter((row) => row.id)
                  .sort((a, b) => a.name.localeCompare(b.name))
              )
            }
          }
          setExpertsLoaded(true)
        }
      } catch {
        /* ignore */
      }
    })()
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.set('status', statusFilter)
        const r = await fetch(`/api/admin/credit-funding?${params}`)
        if (!r.ok) throw new Error('Failed to load')
        setApplications(await r.json())
        setError('')
      } catch {
        setError('Failed to load applications')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [statusFilter])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) {
      loadDetail(id, { resetTab: true })
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
        setListPanelOpen(false)
      }
    }
  }, [searchParams])

  const intelligenceDeepLink = useMemo(() => {
    const letters = parseDisputeLetterStep(searchParams.get('letters'))
    const session = searchParams.get('session')
    return {
      initialView: letters ? ('letters' as const) : ('analysis' as const),
      initialLetterStep: letters || ('health' as const),
      initialSessionId: session,
    }
  }, [searchParams])

  useEffect(() => {
    if (!selected?.id) {
      setMessagesLastReadAt(null)
      return
    }
    setMessagesLastReadAt(getCfMessageLastReadAt(selected.id))
  }, [selected?.id])

  const unreadMessageCount = useMemo(
    () => countUnreadApplicantMessages(messages, messagesLastReadAt),
    [messages, messagesLastReadAt]
  )
  const unreadMessageLabel = formatUnreadBadgeCount(unreadMessageCount)

  useEffect(() => {
    if (activeTab !== 'messages' || !selected?.id) return
    const iso = markCfMessagesRead(selected.id, messages)
    setMessagesLastReadAt(iso)
  }, [activeTab, selected?.id, messages])

  useEffect(() => {
    if (!selected?.id) return
    const applicationId = selected.id
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void (async () => {
        try {
          const r = await fetch(`/api/admin/credit-funding?id=${encodeURIComponent(applicationId)}`)
          if (!r.ok) return
          const data = await r.json()
          if (Array.isArray(data.messages)) setMessages(data.messages)
        } catch {
          /* ignore poll errors */
        }
      })()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [selected?.id])

  const loadDetail = async (id: string, options?: { resetTab?: boolean }) => {
    setDetailLoading(true)
    try {
      const r = await fetch(`/api/admin/credit-funding?id=${id}&includeDocs=true`)
      if (!r.ok) throw new Error('Failed to load detail')
      const data = await r.json()
      const app = data.application as ApplicationDetail
      setSelected(app)
      setDocuments(data.documents || [])
      setHistory(data.history || [])
      setMessages(data.messages || [])
      setDocRequests(data.docRequests || [])
      setReferral(data.referral || null)
      setEditFields({
        assigned_specialist: app.assigned_specialist || '',
        internal_notes: app.internal_notes || '',
        client_notes: app.client_notes || '',
        next_steps: app.next_steps || '',
        status_notes: '',
      })
      setFundingScores(app.funding_scores || {})
      if (options?.resetTab) {
        const tabParam = searchParams.get('tab')
        const lettersParam = parseDisputeLetterStep(searchParams.get('letters'))
        if (tabParam === 'messages') {
          setActiveTab('messages')
        } else if (tabParam === 'intelligence' || lettersParam) {
          setActiveTab('intelligence')
        } else if (tabParam === 'intake') {
          setActiveTab('intake')
        } else if (tabParam === 'funding') {
          setActiveTab('funding')
        } else if (tabParam === 'overview') {
          setActiveTab('overview')
        } else if (
          app.status === 'under_review' ||
          app.status === 'credit_analysis_complete' ||
          app.status === 'funding_review'
        ) {
          setActiveTab('intelligence')
        } else {
          setActiveTab('overview')
        }
      }
    } catch {
      setError('Failed to load application details')
    } finally {
      setDetailLoading(false)
    }
  }

  const patchApplication = async (body: Record<string, unknown>) => {
    if (!selected) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/credit-funding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, ...body }),
      })
      if (!r.ok) throw new Error('Update failed')
      const updated = await r.json()
      const specialistChanged = Object.prototype.hasOwnProperty.call(body, 'assigned_specialist')
      const assignedExpertName = specialistChanged
        ? experts.find((expert) => expert.id === String(body.assigned_specialist || ''))?.name || ''
        : undefined
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              ...(specialistChanged ? { assigned_expert_name: assignedExpertName } : {}),
            }
          : prev
      )
      setApplications((prev) =>
        prev.map((a) =>
          a.id === selected.id
            ? {
                ...a,
                ...updated,
                status: updated.status,
                ...(specialistChanged ? { assigned_expert_name: assignedExpertName } : {}),
              }
            : a
        )
      )
      await loadDetail(selected.id)
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !newMsg.trim()) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/credit-funding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: selected.id, text: newMsg.trim() }),
      })
      if (!r.ok) throw new Error('Send failed')
      setNewMsg('')
      await loadDetail(selected.id)
    } catch {
      setError('Failed to send message')
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = () => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (search.trim()) params.set('search', search.trim())
    window.open(`/api/admin/credit-funding/export?${params}`, '_blank')
  }

  const revealSensitiveField = async (field: SensitiveRevealField) => {
    if (!selected) return
    setRevealingField(field)
    setRevealFieldError(null)
    setError('')
    try {
      const r = await fetch(
        `/api/admin/credit-funding/${encodeURIComponent(selected.id)}/reveal-sensitive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field }),
        }
      )
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Reveal failed')

      const value = typeof data.value === 'string' ? data.value : ''
      if (!value) throw new Error('Reveal returned an empty value')

      setSelected((prev) => {
        if (!prev) return prev
        if (field === 'monthly_gross_income') {
          return {
            ...prev,
            credit_profile: { ...(prev.credit_profile || {}), monthlyGrossIncome: value },
          }
        }
        if (field === 'annual_income') {
          return {
            ...prev,
            credit_profile: { ...(prev.credit_profile || {}), annualIncome: value },
          }
        }
        if (field === 'business_ein') {
          return {
            ...prev,
            business_profile: { ...(prev.business_profile || {}), ein: value },
          }
        }
        return { ...prev, [field]: value }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reveal field'
      setRevealFieldError({ field, message })
      setError(message)
    } finally {
      setRevealingField(null)
    }
  }

  const renderSensitiveField = (
    label: string,
    field: SensitiveRevealField,
    value?: string | null,
    formatter?: (value: string) => string
  ) => {
    const raw = value == null ? '' : String(value)
    const isMasked = raw === MASKED_VALUE
    const hasRevealedValue = Boolean(raw && !isMasked)
    const fieldError = revealFieldError?.field === field ? revealFieldError.message : ''
    return (
      <div>
        <p className="text-xs font-semibold text-brand-dim uppercase mb-0.5">{label}</p>
        {hasRevealedValue ? (
          <p className="text-brand-text whitespace-pre-wrap break-words">
            {formatter ? formatter(raw) : raw}
          </p>
        ) : isMasked ? (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => revealSensitiveField(field)}
              disabled={revealingField === field}
              className="text-xs font-semibold text-accent underline disabled:opacity-50"
            >
              {revealingField === field ? 'Revealing...' : 'Reveal sensitive value'}
            </button>
            {fieldError ? <p className="text-xs text-red-600">{fieldError}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-brand-muted">Not on file</p>
        )}
      </div>
    )
  }

  const sendApplicationInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteSending(true)
    setError('')
    setInviteNotice('')
    try {
      const r = await fetch('/api/admin/credit-funding/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Failed to send invitation')

      setApplications((prev) => [data, ...prev])
      setShowInviteModal(false)
      setInviteForm({ full_name: '', email: '', phone: '', personal_message: '' })
      setInviteNotice(`Application invitation sent to ${data.email}.`)
      selectApplication(data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setInviteSending(false)
    }
  }

  const resendApplicationInvite = async () => {
    if (!selected) return
    setSaving(true)
    setError('')
    setInviteNotice('')
    try {
      const r = await fetch('/api/admin/credit-funding/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Failed to resend invitation')
      setInviteNotice(`Invitation resent to ${selected.email}.`)
      await loadDetail(selected.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation')
    } finally {
      setSaving(false)
    }
  }

  const replaceDocument = async (doc: DocumentItem, file: File) => {
    if (!selected) return false
    const validation = getCreditFundingFileValidationError(file)
    if (validation) {
      setError(validation)
      return false
    }

    setReplacingDocId(doc.id)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const r = await fetch(
        `/api/admin/credit-funding/documents/${encodeURIComponent(doc.id)}?applicationId=${encodeURIComponent(selected.id)}`,
        { method: 'PUT', body }
      )
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Failed to set letter copy')
      await loadDetail(selected.id)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set letter copy')
      return false
    } finally {
      setReplacingDocId(null)
    }
  }

  const deleteDocument = async (doc: DocumentItem) => {
    if (!selected) return
    if (
      !window.confirm(
        `Delete "${doc.file_name}"?\n\nThis removes the file from storage. The client will no longer see it.`
      )
    ) {
      return
    }

    setDeletingDocId(doc.id)
    try {
      const r = await fetch(
        `/api/admin/credit-funding/documents/${encodeURIComponent(doc.id)}?applicationId=${encodeURIComponent(selected.id)}`,
        { method: 'DELETE' }
      )
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Failed to delete document')
      await loadDetail(selected.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete document')
    } finally {
      setDeletingDocId(null)
    }
  }

  const deleteApplication = async () => {
    if (!selected) return
    const confirmed = window.confirm(
      `Permanently delete ${selected.application_id} (${selected.full_name})?\n\nThis removes all documents, messages, and history. This cannot be undone.`
    )
    if (!confirmed) return

    const deletedId = selected.id
    const deletedLabel = selected.application_id
    setSaving(true)
    setError('')
    setInviteNotice('')
    try {
      const r = await fetch(`/api/admin/credit-funding?id=${encodeURIComponent(deletedId)}`, {
        method: 'DELETE',
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Failed to delete application')

      setSelected(null)
      setDocuments([])
      setMessages([])
      setHistory([])
      setDocRequests([])
      setApplications((prev) => prev.filter((a) => a.id !== deletedId))
      setInviteNotice(`Deleted application ${data.application_id || deletedLabel}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete application')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = q
      ? applications.filter(
        (a) =>
          a.full_name.toLowerCase().includes(q) ||
          a.application_id.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.assigned_specialist || '').toLowerCase().includes(q) ||
          (a.assigned_expert_name || '').toLowerCase().includes(q)
      )
      : applications
    return [...rows].sort(compareCreditFundingApplicationsByStatus)
  }, [applications, search])

  const pendingDocCount = docRequests.filter((d) => d.status === 'pending').length

  const handleStatusChange = async (payload: WorkflowStepPayload) => {
    if (!selected) return false
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('id', selected.id)
      fd.append('status', payload.status)
      fd.append('notify_client', payload.notifyClient ? 'true' : 'false')
      if (payload.notes) fd.append('status_notes', payload.notes)
      for (const attachment of payload.attachments || []) {
        fd.append('attachments', attachment.file)
        fd.append('attachment_titles', attachment.title)
      }

      const r = await fetch('/api/admin/credit-funding/workflow', { method: 'POST', body: fd })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || 'Update failed')
      const updated = data
      setSelected((prev) => (prev ? { ...prev, ...updated } : prev))
      setApplications((prev) =>
        prev.map((a) => (a.id === selected.id ? { ...a, ...updated, status: updated.status } : a))
      )
      setEditFields((f) => ({ ...f, status_notes: '' }))
      await loadDetail(selected.id)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
      return false
    } finally {
      setSaving(false)
    }
  }

  const showDocRequestPanel =
    selected?.status === 'documents_pending' ||
    selected?.status === 'additional_information_requested' ||
    selected?.status === 'submitted'

  const selectedNeedsFunding = selected
    ? needsFundingWorkflow(selected.credit_goals || [], selected.funding_use || '', {
        ownsBusiness: Boolean(selected.owns_business),
        fundingAmount: selected.funding_amount,
        serviceType: selected.service_type,
      })
    : false

  const showDocumentsProminent =
    selected?.status === 'under_review' ||
    selected?.status === 'credit_analysis_complete' ||
    selected?.status === 'funding_review' ||
    showDocRequestPanel

  const showFundingSummary =
    selected?.status === 'approved' ||
    selected?.status === 'completed'

  const downloadIntakePdf = async () => {
    if (!selected || downloadingIntake) return
    setDownloadingIntake(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/credit-funding/${encodeURIComponent(selected.id)}/intake-pdf`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401 && data.code === 'SESSION_EXPIRED') return
        throw new Error(data.error || 'Could not download the intake PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = /filename="([^"]+)"/.exec(disposition)
      link.href = url
      link.download = match?.[1] || `Intake-${selected.application_id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the intake PDF')
    } finally {
      setDownloadingIntake(false)
    }
  }

  const renderIntakeDownloadButton = (compact = false) => (
    <button
      type="button"
      onClick={() => void downloadIntakePdf()}
      disabled={!selected || downloadingIntake}
      className={
        compact
          ? 'text-xs font-semibold text-accent hover:underline disabled:opacity-50'
          : 'shrink-0 px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 disabled:opacity-50'
      }
    >
      {downloadingIntake ? 'Preparing PDF…' : 'Download intake PDF'}
    </button>
  )

  const renderDocumentList = () => {
    const listed = [...documents].sort((a, b) => {
      const typeCmp = a.document_type.localeCompare(b.document_type)
      if (typeCmp !== 0) return typeCmp
      const aCopy = isLetterWorkingCopyPath(a.storage_path)
      const bCopy = isLetterWorkingCopyPath(b.storage_path)
      if (aCopy !== bCopy) return aCopy ? 1 : -1
      return (a.created_at || '').localeCompare(b.created_at || '')
    })

    return (
    <>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-bold">Uploaded Documents</h3>
        {renderIntakeDownloadButton(true)}
      </div>
      {listed.length === 0 ? (
        <p className="text-sm text-brand-dim">No documents.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-brand-dim">
            Original client uploads stay on file. Use for letters sets the photo attached to dispute letters without removing the original.
          </p>
          {listed.map((doc) => {
            const letterCopy = isLetterWorkingCopyPath(doc.storage_path)
            const canSetLetterCopy =
              doc.document_type !== 'staff_shared' && !doc.storage_path?.includes('/staff_shared/')
            return (
            <div key={doc.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 bg-neutral-50 rounded-lg text-sm">
              <div className="min-w-0">
                <p className="font-medium">{documentDisplayLabel(doc.document_type)}</p>
                <p className="text-xs text-brand-dim truncate">{doc.file_name}</p>
                <p className="text-[11px] text-brand-muted mt-0.5">
                  {letterCopy ? 'Used for letters' : 'Original client upload'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
                {doc.signedUrl && (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    View
                  </a>
                )}
                {canSetLetterCopy &&
                  Boolean(doc.signedUrl) &&
                  ((doc.mime_type || '').startsWith('image/') ||
                    /\.(png|jpe?g|webp)$/i.test(doc.file_name)) && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-accent hover:underline"
                      onClick={() => setCropDoc(doc)}
                    >
                      Crop for letters
                    </button>
                  )}
                {canSetLetterCopy && (
                  <label className="text-xs font-semibold text-accent hover:underline cursor-pointer">
                    {replacingDocId === doc.id
                      ? 'Saving…'
                      : letterCopy
                        ? 'Replace letter copy'
                        : 'Use for letters'}
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.jpg,.jpeg,.png,.txt,application/pdf,image/png,image/jpeg,text/plain"
                      disabled={replacingDocId === doc.id}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (file) void replaceDocument(doc, file)
                      }}
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => deleteDocument(doc)}
                  disabled={deletingDocId === doc.id}
                  className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                >
                  {deletingDocId === doc.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </>
    )
  }

  const renderDocRequestPanel = () => (
    <div className="mb-5 p-4 bg-amber-50/50 rounded-xl border border-amber-200/80">
      <h4 className="text-sm font-bold mb-1 text-brand-text">Request Document</h4>
      <p className="text-xs text-brand-muted mb-3">Send a document request to the applicant — they will receive an email and can upload in their portal.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        <select className={inputClass} value={docReqType} onChange={(e) => {
          setDocReqType(e.target.value)
          setDocReqLabel(DOC_LABELS_MAP[e.target.value] || e.target.value)
        }}>
          <option value="">Select document type</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>{DOC_LABELS_MAP[t]}</option>
          ))}
        </select>
        <input className={inputClass} placeholder="Label" value={docReqLabel} onChange={(e) => setDocReqLabel(e.target.value)} />
      </div>
      <textarea
        className={`${inputClass} min-h-[64px] mb-2`}
        placeholder="Note for the client (optional)"
        value={docReqNotes}
        onChange={(e) => setDocReqNotes(e.target.value)}
      />
      <button
        type="button"
        disabled={!docReqType || !docReqLabel || saving}
        onClick={() => {
          patchApplication({
            document_request: {
              document_type: docReqType,
              label: docReqLabel,
              notes: docReqNotes.trim() || undefined,
            },
          })
          setDocReqType('')
          setDocReqLabel('')
          setDocReqNotes('')
        }}
        className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
      >
        Send document request
      </button>
      {docRequests.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-brand-muted">
          {docRequests.map((d) => (
            <li key={d.id} className={d.status === 'pending' ? 'text-orange-800 font-medium' : ''}>
              {d.label} — {d.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const inputClass = 'w-full py-2 px-3 bg-neutral-50 border border-brand-border rounded-xl text-sm'
  const isCreditExpert = role === 'credit_manager'
  const waiting = applications.filter((app) => applicationIsWaiting(app.status))
  const emptyListCopy = loading
    ? 'Loading…'
    : !isAdmin && applications.length === 0
      ? 'No clients are assigned to you yet. An admin assigns the clients you are responsible for.'
      : applications.length === 0
        ? 'No applications found.'
        : 'No applications match this search.'
  const expertNameFor = (app: ApplicationListItem) => app.assigned_expert_name?.trim() || '—'
  const selectedExpertId = experts.some((expert) => expert.id === editFields.assigned_specialist)
    ? editFields.assigned_specialist
    : ''

  const sendAssignment = () => {
    const untouchedLegacy =
      editFields.assigned_specialist !== '' && selectedExpertId === ''
    if (isAdmin && expertsLoaded && !untouchedLegacy) {
      void patchApplication({ assigned_specialist: selectedExpertId })
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-brand-text">
            Credit &amp; Funding
          </h1>
          <p className="mt-1 max-w-xl text-sm text-brand-muted">
            {isCreditExpert
              ? 'You only see the clients assigned to you.'
              : 'Applications, credit analysis, and funding assessments'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-brand-text">
              {applications.length} {isCreditExpert ? 'assigned' : 'clients'}
            </span>
            {waiting.length > 0 && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-text shadow-[0_8px_20px_-16px_rgba(10,10,10,0.7)]">
                {waiting.length} waiting on you
              </span>
            )}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => {
              setDraftEditorId(null)
              setDraftEditorMode('draft')
              setShowDraftEditor(true)
              setSelected(null)
              setInviteNotice('')
              setError('')
            }}
            className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
          >
            New Draft Application
          </button>
          <button
            type="button"
            onClick={() => {
              setShowInviteModal(true)
              setInviteNotice('')
              setError('')
            }}
            className="w-full rounded-xl bg-brand-text px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 sm:w-auto"
          >
            Send Application to Client
          </button>
          <button onClick={exportCsv} className="w-full rounded-xl border border-brand-border bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50 sm:w-auto">
            Export CSV
          </button>
        </div>
      </div>

      {waiting.length > 0 && (
        <section className="mb-6 rounded-2xl bg-accent-soft/70 p-4">
          <h2 className="mb-3 text-sm font-semibold text-brand-text">Waiting on you</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {waiting.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => selectApplication(app.id)}
                className="rounded-2xl bg-white px-3.5 py-3 text-left shadow-[0_12px_28px_-18px_rgba(10,10,10,0.55)] hover:ring-2 hover:ring-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-brand-text">{app.full_name}</div>
                    <div className="mt-0.5 truncate text-xs text-brand-muted">{app.email}</div>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <CreditExpertsPanel />

      {showDraftEditor && (
        <div className="mb-6">
          <StaffDraftEditor
            draftId={draftEditorId}
            mode={draftEditorMode}
            onClose={() => {
              const wasIntake = draftEditorMode === 'admin-intake'
              const closedId = draftEditorId
              setShowDraftEditor(false)
              setDraftEditorId(null)
              setDraftEditorMode('draft')
              if (wasIntake && closedId) {
                void loadDetail(closedId)
              }
            }}
            onSaved={(id) => {
              setDraftEditorId(id)
              setLoading(true)
              void (async () => {
                try {
                  const params = new URLSearchParams()
                  if (statusFilter !== 'all') params.set('status', statusFilter)
                  const r = await fetch(`/api/admin/credit-funding?${params}`)
                  if (r.ok) setApplications(await r.json())
                  if (draftEditorMode === 'admin-intake' && id) {
                    await loadDetail(id)
                    setInviteNotice('Intake corrections saved.')
                  }
                } finally {
                  setLoading(false)
                }
              })()
            }}
            onFinalized={(id) => {
              setShowDraftEditor(false)
              setDraftEditorId(null)
              setDraftEditorMode('draft')
              void (async () => {
                try {
                  const params = new URLSearchParams()
                  if (statusFilter !== 'all') params.set('status', statusFilter)
                  const r = await fetch(`/api/admin/credit-funding?${params}`)
                  if (r.ok) setApplications(await r.json())
                } catch {
                  /* ignore */
                }
                selectApplication(id)
                setInviteNotice('Draft finalized and submitted into the normal pipeline.')
              })()
            }}
          />
        </div>
      )}
      {inviteNotice && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">{inviteNotice}</div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-lg bg-white border border-brand-border rounded-xl shadow-xl p-6">
            <h2 className="text-lg font-bold text-brand-text mb-1">Send Application to Client</h2>
            <p className="text-sm text-brand-muted mb-4">
              We&apos;ll email a secure link so the client can complete the Credit &amp; Funding intake form.
            </p>
            <form onSubmit={sendApplicationInvite} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-brand-dim">Client name *</label>
                <input
                  className={inputClass}
                  required
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-dim">Email *</label>
                <input
                  type="email"
                  className={inputClass}
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-dim">Phone (optional — pre-fills form)</label>
                <input
                  type="tel"
                  className={inputClass}
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-dim">Personal message (optional)</label>
                <textarea
                  className={`${inputClass} min-h-[90px]`}
                  value={inviteForm.personal_message}
                  onChange={(e) => setInviteForm((f) => ({ ...f, personal_message: e.target.value }))}
                  placeholder="Add a short note that appears in the invitation email."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-sm font-semibold border border-brand-border rounded-lg hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSending}
                  className="px-4 py-2 text-sm font-semibold bg-brand-text text-white rounded-lg disabled:opacity-50"
                >
                  {inviteSending ? 'Sending…' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className={`grid grid-cols-1 gap-6 ${listPanelOpen ? 'lg:grid-cols-5' : 'lg:grid-cols-1'}`}>
        {listPanelOpen && (
        <div className="lg:col-span-2">
          <div className="mb-3 space-y-3">
            <input className={inputClass} placeholder="Search name, email, or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_28px_-18px_rgba(10,10,10,0.55)]">
            <div className="overflow-x-auto">
              <table className="hidden w-full text-xs sm:table">
                <thead className="border-b border-brand-border bg-neutral-50">
                  <tr>
                    {['ID', 'Name', 'Status', 'Credit expert', 'Updated'].map((heading) => (
                      <th key={heading} className="p-2 text-left font-semibold text-brand-dim">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-sm text-brand-dim">
                        {emptyListCopy}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((app) => (
                      <tr
                        key={app.id}
                        onClick={() => selectApplication(app.id)}
                        className={`cursor-pointer border-b border-brand-border hover:bg-neutral-50 ${selected?.id === app.id ? 'bg-accent-soft/40' : ''}`}
                      >
                        <td className="p-2 font-mono">{app.application_id}</td>
                        <td className="p-2">{app.full_name}</td>
                        <td className="p-2">
                          <StatusBadge status={app.status} />
                          {app.status === 'draft' && (
                            <span className="mt-0.5 block text-[10px] text-brand-muted">Saved · incomplete</span>
                          )}
                          {app.status === 'invitation_pending' && app.draft_source === 'staff_manual' && (
                            <span className="mt-0.5 block text-[10px] text-brand-muted">Client finishing draft</span>
                          )}
                        </td>
                        <td className="p-2 text-brand-dim">{expertNameFor(app)}</td>
                        <td className="p-2 text-brand-dim">{formatListDate(app.updated_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="max-h-[640px] space-y-2 overflow-y-auto p-2 sm:hidden">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-brand-dim">
                  {emptyListCopy}
                </div>
              ) : (
                filtered.map((app) => (
                  <ClientCard
                    key={app.id}
                    app={app}
                    selected={selected?.id === app.id}
                    expertName={expertNameFor(app)}
                    onSelect={() => selectApplication(app.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
        )}

        <div className={`${listPanelOpen ? 'lg:col-span-3' : 'lg:col-span-1'} rounded-2xl bg-white p-4 shadow-[0_18px_40px_-28px_rgba(10,10,10,0.65)] sm:p-6`}>
          {!listPanelOpen && (
            <button
              type="button"
              onClick={() => setListPanelOpen(true)}
              className="mb-4 inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-brand-border rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Show applications list
            </button>
          )}
          {!selected ? (
            <div className="rounded-2xl bg-accent-soft/50 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-brand-text">
                {isCreditExpert ? 'Choose a client' : 'Choose an application'}
              </p>
              <p className="mt-1 text-sm text-brand-dim">
                {isCreditExpert
                  ? 'Open a client assigned to you to review their file, analysis, and messages.'
                  : 'Select a client to review their file and assign a credit expert.'}
              </p>
            </div>
          ) : detailLoading ? (
            <p className="text-sm text-brand-dim">Loading details…</p>
          ) : (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  {listPanelOpen && (
                    <button
                      type="button"
                      onClick={() => setListPanelOpen(false)}
                      className="hidden lg:inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-brand-dim border border-brand-border rounded-lg hover:bg-neutral-50 transition-colors"
                      title="Hide applications list"
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M7 5L3 10L7 15M13 5L17 10L13 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Focus
                    </button>
                  )}
                  <div className="min-w-0">
                  <h2 className="text-xl font-bold text-brand-text">{selected.full_name}</h2>
                  {selected.lead_id && (
                    <Link href={`/admin/pipeline/${selected.lead_id}`} className="text-xs font-semibold text-accent hover:underline">
                      Open marketing pipeline
                    </Link>
                  )}
                  <p className="text-sm text-brand-dim">{selected.application_id} · {selected.service_type?.replace(/_/g, ' ')}</p>
                  {referral && (
                    <p className="text-xs text-brand-muted mt-1">
                      Referred by{' '}
                      {referral.referrerClientId ? (
                        <Link href={`/admin/referrals/${referral.referrerClientId}`} className="text-accent hover:underline">
                          {referral.referrerName}
                        </Link>
                      ) : (
                        referral.referrerName
                      )}
                      {referral.code ? ` · ${referral.code}` : ''} · {referral.status.replace(/_/g, ' ')}
                    </p>
                  )}
                  </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
                  <div className="w-full sm:w-64">
                    <label htmlFor="credit-expert" className="mb-1 block text-xs font-semibold text-brand-dim">
                      Credit expert
                    </label>
                    {isAdmin ? (
                      <select
                        id="credit-expert"
                        className={inputClass}
                        value={selectedExpertId}
                        onChange={(e) => setEditFields((f) => ({ ...f, assigned_specialist: e.target.value }))}
                      >
                        <option value="">Unassigned</option>
                        {experts.map((expert) => (
                          <option key={expert.id} value={expert.id}>
                            {expert.name || expert.email}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p id="credit-expert" className="w-full rounded-xl bg-accent-soft px-3 py-2 text-sm text-brand-text">
                        {selected.assigned_expert_name?.trim() || 'Assigned to you'}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={saving || !expertsLoaded}
                      onClick={sendAssignment}
                      className="w-full shrink-0 rounded-xl bg-brand-text px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                    >
                      Assign
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={deleteApplication}
                      className="w-full shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-brand-red hover:bg-red-50 disabled:opacity-50 sm:w-auto"
                    >
                      Delete application
                    </button>
                  )}
                </div>
              </div>

              {selected.status === 'invitation_pending' ? (
                <div className="mb-5 p-4 bg-sky-50 border border-sky-200 rounded-xl">
                  <p className="text-sm font-semibold text-sky-900 mb-1">Waiting for client to complete the application</p>
                  <p className="text-sm text-sky-800 mb-3">
                    An invitation email was sent to {selected.email}.
                    {selected.invite_expires_at && (
                      <> Link expires {new Date(selected.invite_expires_at).toLocaleString()}.</>
                    )}
                  </p>
                  {selected.invite_personal_message && (
                    <p className="text-sm text-sky-900 mb-3 whitespace-pre-wrap">
                      <span className="font-semibold">Your message:</span> {selected.invite_personal_message}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={resendApplicationInvite}
                    className="px-4 py-2 text-sm font-semibold border border-sky-300 rounded-lg bg-white hover:bg-sky-100 disabled:opacity-50"
                  >
                    Resend invitation email
                  </button>
                </div>
              ) : (
                <AdminApplicationWorkflow
                  currentStatus={selected.status}
                  history={history}
                  statusNotes={editFields.status_notes}
                  onStatusNotesChange={(notes) => setEditFields((f) => ({ ...f, status_notes: notes }))}
                  onStatusChange={handleStatusChange}
                  saving={saving}
                  pendingDocCount={pendingDocCount}
                  needsFunding={selectedNeedsFunding}
                />
              )}

              <div className="my-8 sm:my-10 flex flex-wrap gap-3 sm:gap-3.5 border-y border-brand-border py-5 sm:py-6">
                {(
                  [
                    { id: 'overview', label: 'Overview' },
                    { id: 'intake', label: 'Intake' },
                    { id: 'intelligence', label: 'Analysis' },
                    { id: 'funding', label: 'Funding' },
                    { id: 'messages', label: 'Messages' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-3 sm:px-6 sm:py-3.5 text-base sm:text-lg font-semibold transition-colors ${
                      activeTab === tab.id
                        ? 'bg-brand-text text-white shadow-sm'
                        : 'bg-accent-soft text-brand-text hover:bg-accent-soft/80'
                    }`}
                  >
                    {tab.label}
                    {tab.id === 'messages' && unreadMessageCount > 0 ? (
                      <span
                        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none ${
                          activeTab === 'messages'
                            ? 'bg-white text-red-600'
                            : 'bg-red-500 text-white'
                        }`}
                        aria-label={`${unreadMessageCount} unread message${unreadMessageCount === 1 ? '' : 's'}`}
                      >
                        {unreadMessageLabel}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <>
                  {(selected.service_type === 'credit_repair' ||
                    selected.service_type === 'credit_and_funding') && (
                    <div className="mb-5 p-4 bg-white rounded-xl border border-brand-border">
                      <h3 className="text-sm font-bold text-brand-text mb-3">Repair fee</h3>
                      <CreditRepairBillingPanel
                        client={{ id: selected.client_id || '', email: selected.email }}
                        applicationId={selected.id}
                        adminView
                      />
                    </div>
                  )}

                  {showDocRequestPanel && renderDocRequestPanel()}

                  {showDocumentsProminent && !showDocRequestPanel && (
                    <div className="mb-5 p-4 bg-neutral-50 rounded-xl border border-brand-border">
                      {renderDocumentList()}
                    </div>
                  )}

                  {showFundingSummary && selected.funding_scores && (
                    <div className="mb-5 p-4 bg-green-50/50 rounded-xl border border-green-200/80">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-sm font-bold">Staff assessment summary</h4>
                        <button
                          type="button"
                          onClick={() => setActiveTab('funding')}
                          className="text-xs font-semibold text-accent hover:underline"
                        >
                          Edit in Funding →
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center mb-3">
                        {[
                          ['Revenue (0–100)', selected.funding_scores.revenue_score],
                          ['Staff funding readiness', selected.funding_scores.funding_readiness],
                          ['Staff credit readiness', selected.funding_scores.credit_readiness],
                        ].map(([label, val]) => (
                          <div key={label as string} className="p-2 bg-white rounded-lg border border-brand-border">
                            <p className="text-lg font-bold text-accent">{val ?? '—'}</p>
                            <p className="text-[10px] text-brand-dim uppercase leading-tight">{label}</p>
                          </div>
                        ))}
                      </div>
                      {selected.funding_scores.estimated_range && (
                        <p className="text-sm text-brand-muted">
                          <span className="font-semibold">Est. Range:</span> {selected.funding_scores.estimated_range}
                        </p>
                      )}
                      {selected.next_steps && (
                        <p className="text-sm text-brand-muted mt-2 whitespace-pre-wrap">
                          <span className="font-semibold">Next Steps:</span> {selected.next_steps}
                        </p>
                      )}
                    </div>
                  )}

                  {!showFundingSummary && (
                    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-dashed border-brand-border bg-neutral-50 px-4 py-3">
                      <p className="text-sm text-brand-muted">
                        Run credit analysis in <span className="font-semibold text-brand-text">Analysis</span>, then
                        save staff scores in <span className="font-semibold text-brand-text">Funding</span>.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('funding')}
                        className="shrink-0 text-xs font-semibold text-accent hover:underline"
                      >
                        Open Funding →
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 text-sm">
                    {[
                      ['Email', selected.email],
                      ['Phone', selected.phone],
                      ['Address', `${selected.address}, ${selected.city}, ${selected.state} ${selected.zip_code}`],
                      ['Service Type', selected.service_type?.replace(/_/g, ' ')],
                      ['Funding Summary', selected.funding_goals],
                      ['Submitted', new Date(selected.created_at).toLocaleString()],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs font-semibold text-brand-dim uppercase mb-0.5">{label}</p>
                        <p className="text-brand-text">{value}</p>
                      </div>
                    ))}
                    {renderSensitiveField('Date of Birth', 'date_of_birth', selected.date_of_birth)}
                    {renderSensitiveField('Social Security Number', 'ssn', selected.ssn, (value) =>
                      formatSsnFull(value.replace(/\D/g, ''))
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-brand-dim">Internal Notes (staff only)</label>
                      <textarea className={`${inputClass} min-h-[80px]`} value={editFields.internal_notes}
                        onChange={(e) => setEditFields((f) => ({ ...f, internal_notes: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-brand-dim">Client-Facing Notes</label>
                      <textarea className={`${inputClass} min-h-[60px]`} value={editFields.client_notes}
                        onChange={(e) => setEditFields((f) => ({ ...f, client_notes: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-brand-dim">Next Steps</label>
                      <textarea className={`${inputClass} min-h-[60px]`} value={editFields.next_steps}
                        onChange={(e) => setEditFields((f) => ({ ...f, next_steps: e.target.value }))} />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => patchApplication({ resend_portal_setup: true })}
                    className="mb-5 mr-3 px-4 py-2 border border-brand-border text-sm font-semibold rounded-lg hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Email Portal Setup Link
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      patchApplication({
                        internal_notes: editFields.internal_notes,
                        client_notes: editFields.client_notes,
                        next_steps: editFields.next_steps,
                      })
                    }
                    className="mb-5 w-full rounded-xl bg-brand-text px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                  >
                    Save notes
                  </button>

                  {!showDocRequestPanel && (
                    <details className="mb-5 group">
                      <summary className="text-sm font-bold cursor-pointer hover:text-accent list-none flex items-center gap-1">
                        <span className="group-open:rotate-90 transition-transform inline-block text-brand-dim">›</span>
                        Request document from client
                      </summary>
                      <div className="mt-3">{renderDocRequestPanel()}</div>
                    </details>
                  )}

                  {!showDocumentsProminent && (
                    <details className="mb-5 group" open={documents.length > 0}>
                      <summary className="text-sm font-bold cursor-pointer hover:text-accent list-none flex items-center gap-1">
                        <span className="group-open:rotate-90 transition-transform inline-block text-brand-dim">›</span>
                        Uploaded documents ({documents.length})
                      </summary>
                      <div className="mt-3">{renderDocumentList()}</div>
                    </details>
                  )}

                  {showDocumentsProminent && showDocRequestPanel && (
                    <div className="mb-5 p-4 bg-neutral-50 rounded-xl border border-brand-border">
                      {renderDocumentList()}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'intake' && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <p className="text-sm text-brand-muted max-w-xl">
                      Download this intake and the client&apos;s uploaded files as one PDF. Passwords and security answers stay on this screen.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {(isAdmin || isCreditExpert) && selected.status !== 'draft' && (
                        <button
                          type="button"
                          onClick={() => openAdminIntakeEditor(selected.id)}
                          className="px-3 py-2 text-xs font-semibold border border-brand-border rounded-lg hover:bg-neutral-50"
                        >
                          Edit intake
                        </button>
                      )}
                      {renderIntakeDownloadButton()}
                    </div>
                  </div>
                  <DetailSection title="Personal Information">
                    <DetailField label="Full Name" value={selected.full_name} />
                    {renderSensitiveField('Date of Birth', 'date_of_birth', selected.date_of_birth)}
                    {renderSensitiveField('Social Security Number', 'ssn', selected.ssn, (value) =>
                      formatSsnFull(value.replace(/\D/g, ''))
                    )}
                    <DetailField label="Email" value={selected.email} />
                    <DetailField label="Phone" value={selected.phone} />
                    <DetailField label="Address" value={`${selected.address}, ${selected.city}, ${selected.state} ${selected.zip_code}`} />
                    <DetailField label="Referred by" value={selected.referred_by} />
                  </DetailSection>

                  <DetailSection title="Credit Profile">
                    <DetailField label="Credit Score" value={String(selected.credit_profile?.creditScore || '')} />
                    <DetailField label="Open Credit Cards" value={String(selected.credit_profile?.openCreditCards || '')} />
                    <DetailField label="Inquiries" value={String(selected.credit_profile?.inquiries || '')} />
                    {renderSensitiveField(
                      'Monthly Gross Income',
                      'monthly_gross_income',
                      String(selected.credit_profile?.monthlyGrossIncome || '')
                    )}
                    {renderSensitiveField(
                      'Annual Income',
                      'annual_income',
                      String(selected.credit_profile?.annualIncome || '')
                    )}
                    <DetailField label="Bankruptcy" value={yesNo(selected.credit_profile?.bankruptcy as boolean | undefined)} />
                    <DetailField label="Collections" value={yesNo(selected.credit_profile?.collections as boolean | undefined)} />
                    <DetailField label="Charge-offs" value={yesNo(selected.credit_profile?.chargeOffs as boolean | undefined)} />
                    <DetailField label="Late Payments (24 mo)" value={yesNo(selected.credit_profile?.latePayments24Months as boolean | undefined)} />
                    <DetailField label="Employed" value={yesNo(selected.credit_profile?.employed as boolean | undefined)} />
                    <DetailField label="Business Owner" value={yesNo(selected.credit_profile?.businessOwner as boolean | undefined)} />
                  </DetailSection>

                  <DetailSection title="Credit Monitoring Provider">
                    <DetailField label="Provider" value={selected.selected_credit_provider} />
                    {renderSensitiveField('Username / Login', 'provider_username', selected.provider_username)}
                    {renderSensitiveField('Password', 'provider_password', selected.provider_password)}
                    {renderSensitiveField('Experian.com Email', 'experian_email', selected.experian_email)}
                    {renderSensitiveField('Experian.com Password', 'experian_password', selected.experian_password)}
                    {renderSensitiveField(
                      'Experian security answer',
                      'experian_security_answer',
                      selected.experian_security_answer
                    )}
                    {renderSensitiveField('Experian 4-digit code', 'experian_pin', selected.experian_pin)}
                    {renderSensitiveField('CFPB Portal Email', 'cfpb_email', selected.cfpb_email)}
                    {renderSensitiveField('CFPB Portal Password', 'cfpb_password', selected.cfpb_password)}
                  </DetailSection>

                  <DetailSection title="Goals & Funding">
                    <DetailField label="Primary Goals" value={selected.primary_credit_goals_text} />
                    <DetailField label="Selected Goals" value={(selected.credit_goals || []).join(', ')} />
                    <DetailField label="Funding Amount" value={selected.funding_amount} />
                    <DetailField label="Funding Use" value={selected.funding_use} />
                    <DetailField label="Timeframe" value={selected.funding_timeframe} />
                    <DetailField label="Owns Business" value={yesNo(selected.owns_business)} />
                    <DetailField label="Business Name" value={selected.business_name} />
                    <DetailField label="Additional Notes" value={selected.goals_notes} />
                  </DetailSection>

                  {(selected.business_profile && Object.keys(selected.business_profile).length > 0) && (
                    <DetailSection title="Business Information">
                      <DetailField label="Legal Name" value={String(selected.business_profile.legalName || '')} />
                      <DetailField label="DBA" value={String(selected.business_profile.dba || '')} />
                      {renderSensitiveField('EIN', 'business_ein', String(selected.business_profile.ein || ''))}
                      <DetailField label="Entity Type" value={String(selected.business_profile.entityType || '')} />
                      <DetailField label="Industry" value={String(selected.business_profile.industry || '')} />
                      <DetailField
                        label="Month Opened"
                        value={
                          establishedMonthLabel(String(selected.business_profile.monthEstablished || '')) || '—'
                        }
                      />
                      <DetailField label="Year Established" value={String(selected.business_profile.yearEstablished || '')} />
                      <DetailField label="Employees" value={String(selected.business_profile.numberOfEmployees || '')} />
                      <DetailField label="Annual Revenue" value={String(selected.business_profile.annualRevenue || '')} />
                      <DetailField label="Business Address" value={[selected.business_profile.address, selected.business_profile.city, selected.business_profile.state, selected.business_profile.zipCode].filter(Boolean).join(', ')} />
                      <DetailField label="Business Phone" value={String(selected.business_profile.phone || '')} />
                      <DetailField label="Business Email" value={String(selected.business_profile.email || '')} />
                      <DetailField label="Website" value={String(selected.business_profile.website || '')} />
                      <DetailField label="Description" value={String(selected.business_profile.businessDescription || '')} />
                      <DetailField label="Funding Purposes" value={Array.isArray(selected.business_profile.fundingPurposes) ? (selected.business_profile.fundingPurposes as string[]).join(', ') : ''} />
                    </DetailSection>
                  )}

                  <DetailSection title="Consent & Signature">
                    <DetailField label="Accurate Information" value={yesNo(selected.consent_data?.accurateInfo)} />
                    <DetailField label="Authorize Review" value={yesNo(selected.consent_data?.authorizeReview)} />
                    <DetailField label="Agree to Terms" value={yesNo(selected.consent_data?.agreeTerms)} />
                    {renderSensitiveField('Typed Signature', 'typed_signature', selected.typed_signature)}
                    <DetailField label="Signature Date" value={selected.signature_date} />
                  </DetailSection>
                </div>
              )}

              {activeTab === 'intelligence' && selected && (
                <CreditIntelligencePanel
                  applicationId={selected.id}
                  intakeCreditReports={documents
                    .filter((doc) => doc.document_type === 'credit_report' && !isLetterWorkingCopyPath(doc.storage_path))
                    .map((doc) => ({
                      id: doc.id,
                      file_name: doc.file_name,
                      signedUrl: doc.signedUrl,
                      created_at: doc.created_at,
                      document_type: doc.document_type,
                    }))}
                  fundingContext={{
                    credit_goals: selected.credit_goals || [],
                    funding_goals: selected.funding_goals || '',
                    funding_amount: selected.funding_amount || '',
                    funding_timeframe: selected.funding_timeframe || '',
                    monthly_income: String(selected.credit_profile?.monthlyGrossIncome || ''),
                    annual_income: String(selected.credit_profile?.annualIncome || ''),
                    annual_revenue: String(selected.business_profile?.annualRevenue || ''),
                    business_year_established: String(selected.business_profile?.yearEstablished || ''),
                    self_reported_score: String(selected.credit_profile?.creditScore || ''),
                    self_reported_collections: Boolean(selected.credit_profile?.collections),
                    self_reported_charge_offs: Boolean(selected.credit_profile?.chargeOffs),
                    self_reported_bankruptcy: Boolean(selected.credit_profile?.bankruptcy),
                    self_reported_late_payments: Boolean(selected.credit_profile?.latePayments24Months),
                    self_reported_inquiries: String(selected.credit_profile?.inquiries || ''),
                    document_types: documents.map((d) => d.document_type),
                  }}
                  initialView={intelligenceDeepLink.initialView}
                  initialLetterStep={intelligenceDeepLink.initialLetterStep}
                  initialSessionId={intelligenceDeepLink.initialSessionId}
                />
              )}

              {activeTab === 'funding' && selected && (
                <StaffFundingScoresEditor
                  fundingScores={fundingScores}
                  onChange={setFundingScores}
                  onSave={() => patchApplication({ funding_scores: fundingScores })}
                  saving={saving}
                />
              )}

              {activeTab === 'messages' && (
                <div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2 mb-4">
                    {messages.length === 0 ? (
                      <p className="text-sm text-brand-dim">No messages yet.</p>
                    ) : (
                      messages.map((m) => (
                        <div key={m.id} className={`p-3 rounded-lg text-sm ${m.from_role === 'admin' ? 'bg-accent-soft/40' : 'bg-neutral-50'}`}>
                          <p className="text-xs text-brand-dim">{m.from_name} · {new Date(m.created_at).toLocaleString()}</p>
                          <p className="text-brand-muted whitespace-pre-wrap">{m.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={sendMessage} className="flex gap-2">
                    <input className={`flex-1 ${inputClass}`} placeholder="Reply to applicant…" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} />
                    <button type="submit" disabled={saving || !newMsg.trim()} className="px-4 py-2 bg-brand-text text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {cropDoc?.signedUrl && (
        <LetterIdentityCropModal
          title={documentDisplayLabel(cropDoc.document_type)}
          imageUrl={cropDoc.signedUrl}
          fileName={cropDoc.file_name}
          saving={replacingDocId === cropDoc.id}
          onCancel={() => setCropDoc(null)}
          onSave={(file) => {
            void replaceDocument(cropDoc, file).then((ok) => {
              if (ok) setCropDoc(null)
            })
          }}
        />
      )}
    </div>
  )
}

export default function CreditFundingAdminPage() {
  return (
    <Suspense fallback={<p className="text-sm text-brand-dim">Loading…</p>}>
      <CreditFundingAdminContent />
    </Suspense>
  )
}
