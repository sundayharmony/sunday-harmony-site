'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import DocumentUploadStep from '@/components/credit-funding/DocumentUploadStep'
import { WorkflowStepStrip } from '@/components/credit-funding/WorkflowStepStrip'
import SsnInputField from '@/components/credit-funding/SsnInputField'
import { useStagedDocumentUploads } from '@/components/credit-funding/useStagedDocumentUploads'
import BusinessInfoSection from '@/components/credit-funding/BusinessInfoSection'
import Link from 'next/link'
import {
  CREDIT_PROVIDERS,
  CREDIT_GOAL_OPTIONS,
  EXPERIAN_SIGNUP_URL,
  FUNDING_TIMEFRAMES,
  creditProviderShowsTrialWarning,
  getCreditProviderLinkAction,
  getCreditProviderSignupLink,
  requiresBusinessSection,
  type CreditProfile,
  type ConsentData,
  type BusinessProfile,
  type DocumentType,
} from '@/lib/credit-funding-types'
import {
  IDENTITY_DOCUMENTS,
  BUSINESS_DOCUMENTS,
} from '@/lib/credit-funding-document-steps'
import { isValidSsn } from '@/lib/ssn-utils'

type StepId =
  | 'personal'
  | 'identity'
  | 'credit'
  | 'monitoring'
  | 'goals'
  | 'business-info'
  | 'business-docs'
  | 'consent'

const STEP_LABELS: Record<StepId, string> = {
  personal: 'Personal Information',
  identity: 'Identity Documents',
  credit: 'Credit Profile',
  monitoring: 'Credit Monitoring',
  goals: 'Credit Goals',
  'business-info': 'Business Information',
  'business-docs': 'Business Documents',
  consent: 'Consent & Submit',
}

function getStepFlow(form: Pick<FormState, 'ownsBusiness' | 'fundingUse' | 'creditProfile'>): StepId[] {
  const flow: StepId[] = ['personal', 'identity', 'credit', 'monitoring', 'goals']
  if (requiresBusinessSection(form.ownsBusiness, form.fundingUse, form.creditProfile)) {
    flow.push('business-info', 'business-docs')
  }
  flow.push('consent')
  return flow
}

const REQUIRED_IDENTITY_TYPES: DocumentType[] = ['photo_id', 'proof_of_address', 'mail_proof']

const inputClass =
  'w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors'

const labelClass = 'block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide'

const fid = (name: string) => `cf-${name}`

interface FormState {
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
  showPassword: boolean
  experianEmail: string
  experianPassword: string
  showExperianPassword: boolean
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

function validateBusinessFields(bp: BusinessProfile, errors: Record<string, string>) {
  if (!bp.legalName?.trim()) errors.legalName = 'Required'
  if (!bp.ein?.trim()) errors.ein = 'Required'
  if (!bp.address?.trim()) errors.businessAddress = 'Required'
  if (!bp.city?.trim()) errors.businessCity = 'Required'
  if (!bp.state?.trim() || bp.state.length !== 2) errors.businessState = '2-letter state'
  if (!bp.industry?.trim()) errors.industry = 'Required'
  if (!bp.entityType) errors.entityType = 'Required'
  if (!bp.fundingPurposes?.length) errors.fundingPurposes = 'Select at least one purpose'
}

const initialState: FormState = {
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
  showPassword: false,
  experianEmail: '',
  experianPassword: '',
  showExperianPassword: false,
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
}

export default function CreditFundingForm() {
  const [step, setStep] = useState(0)
  const searchParams = useSearchParams()
  const inviteTokenFromUrl = searchParams.get('invite')?.trim() || ''
  const [inviteToken, setInviteToken] = useState('')
  const [inviteEmailLocked, setInviteEmailLocked] = useState(false)
  const [inviteBanner, setInviteBanner] = useState('')
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteTokenFromUrl))
  const [form, setForm] = useState<FormState>(initialState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [applicationId, setApplicationId] = useState('')
  const [submitError, setSubmitError] = useState('')
  const stagedUploads = useStagedDocumentUploads()

  const stepFlow = useMemo(() => getStepFlow(form), [form.ownsBusiness, form.fundingUse, form.creditProfile])
  const currentStepId = stepFlow[Math.min(step, stepFlow.length - 1)] ?? 'personal'
  const stepStripItems = useMemo(
    () =>
      stepFlow.map((id, i) => ({
        id,
        label: STEP_LABELS[id],
        isComplete: i < step,
        isCurrent: i === step,
        isUpcoming: i > step,
      })),
    [stepFlow, step]
  )

  useEffect(() => {
    setStep((s) => Math.min(s, stepFlow.length - 1))
  }, [stepFlow.length])

  useEffect(() => {
    if (!inviteTokenFromUrl) {
      setInviteLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(`/api/credit-funding/invite?token=${encodeURIComponent(inviteTokenFromUrl)}`)
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          if (!cancelled) {
            setSubmitError(data.error || 'This invitation link is invalid or has expired.')
          }
          return
        }

        if (cancelled) return

        setInviteToken(inviteTokenFromUrl)
        setInviteEmailLocked(true)
        setInviteBanner(`You're completing an application invited by the Sunday Harmony team.`)
        setForm((prev) => ({
          ...prev,
          fullName: data.fullName || prev.fullName,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
        }))
      } catch {
        if (!cancelled) setSubmitError('Could not load your invitation. Please contact Sunday Harmony.')
      } finally {
        if (!cancelled) setInviteLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [inviteTokenFromUrl])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const updateCredit = (key: keyof CreditProfile, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      creditProfile: { ...prev.creditProfile, [key]: value },
    }))
  }

  const toggleGoal = (goal: string) => {
    setForm((prev) => ({
      ...prev,
      creditGoals: prev.creditGoals.includes(goal)
        ? prev.creditGoals.filter((g) => g !== goal)
        : [...prev.creditGoals, goal],
    }))
  }

  const validateStep = (stepId: StepId): boolean => {
    const e: Record<string, string> = {}
    if (stepId === 'personal') {
      if (!form.fullName.trim()) e.fullName = 'Required'
      if (!form.dateOfBirth) e.dateOfBirth = 'Required'
      if (!isValidSsn(form.ssn)) e.ssn = 'Enter a valid 9-digit Social Security Number'
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required'
      if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) e.phone = 'Valid phone required'
      if (!form.address.trim()) e.address = 'Required'
      if (!form.city.trim()) e.city = 'Required'
      if (!form.state.trim() || form.state.length !== 2) e.state = '2-letter state code'
      if (!form.zipCode.trim() || !/^\d{5}(-\d{4})?$/.test(form.zipCode)) e.zipCode = 'Valid ZIP required'
    }
    if (stepId === 'identity') {
      if (stagedUploads.hasUploadInProgress()) {
        e.documents = 'Please wait for uploads to finish'
      } else if (!stagedUploads.isRequiredUploaded(REQUIRED_IDENTITY_TYPES)) {
        e.documents = 'Upload all required identity documents before continuing'
      }
    }
    if (stepId === 'monitoring') {
      if (!form.selectedCreditProvider) e.selectedCreditProvider = 'Select a provider'
      if (!form.providerUsername.trim()) e.providerUsername = 'Required'
      if (!form.providerPassword || form.providerPassword.length < 4) e.providerPassword = 'Required'
      if (!form.experianEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.experianEmail)) {
        e.experianEmail = 'Valid Experian.com email required'
      }
      if (!form.experianPassword || form.experianPassword.length < 4) e.experianPassword = 'Required'
    }
    if (stepId === 'goals') {
      if (!form.primaryCreditGoalsText.trim() && form.creditGoals.length === 0) {
        e.primaryCreditGoalsText = 'Describe your goals or select options below'
      }
      if (!form.fundingAmount.trim()) e.fundingAmount = 'Required'
      if (!form.fundingUse) e.fundingUse = 'Required'
      if (form.ownsBusiness && !form.businessName.trim()) e.businessName = 'Required'
      if (!form.fundingTimeframe) e.fundingTimeframe = 'Required'
    }
    if (stepId === 'business-info') {
      validateBusinessFields(form.businessProfile, e)
    }
    if (stepId === 'business-docs') {
      if (stagedUploads.hasUploadInProgress()) {
        e.documents = 'Please wait for uploads to finish'
      }
    }
    if (stepId === 'consent') {
      if (!form.consent.accurateInfo) e.consent = 'All consent items are required'
      if (!form.consent.authorizeReview) e.consent = 'All consent items are required'
      if (!form.consent.agreeTerms) e.consent = 'All consent items are required'
      if (!form.typedSignature.trim()) e.typedSignature = 'Signature required'
      if (!form.signatureDate) e.signatureDate = 'Date required'
      if (!stagedUploads.isRequiredUploaded(REQUIRED_IDENTITY_TYPES)) {
        e.documents = 'Required identity documents are missing — return to Identity Documents'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (!validateStep(currentStepId)) return
    setSubmitError('')
    setStep((s) => Math.min(s + 1, stepFlow.length - 1))
  }

  const back = () => setStep((s) => Math.max(s - 1, 0))

  const handleSubmit = async () => {
    if (!validateStep('consent')) return
    setSubmitting(true)
    setSubmitError('')
    setUploadProgress(10)

    const session = stagedUploads.getSession()
    const stagedFiles = stagedUploads.getStagedFiles()
    if (!session) {
      setSubmitError('Secure upload session expired. Return to Identity Documents and re-upload your files.')
      setSubmitting(false)
      return
    }
    if (!stagedUploads.isRequiredUploaded(REQUIRED_IDENTITY_TYPES)) {
      setSubmitError('Required identity documents are missing.')
      setSubmitting(false)
      return
    }

    try {
      setUploadProgress(40)

      const fd = new FormData()
      fd.append('fullName', form.fullName)
      fd.append('dateOfBirth', form.dateOfBirth)
      fd.append('ssn', form.ssn)
      fd.append('email', form.email)
      fd.append('phone', form.phone)
      fd.append('address', form.address)
      fd.append('city', form.city)
      fd.append('state', form.state.toUpperCase())
      fd.append('zipCode', form.zipCode)
      fd.append('creditProfile', JSON.stringify(form.creditProfile))
      fd.append('selectedCreditProvider', form.selectedCreditProvider)
      fd.append('providerUsername', form.providerUsername)
      fd.append('providerPassword', form.providerPassword)
      fd.append('experianEmail', form.experianEmail)
      fd.append('experianPassword', form.experianPassword)
      fd.append('primaryCreditGoalsText', form.primaryCreditGoalsText)
      fd.append('creditGoals', JSON.stringify(form.creditGoals))
      fd.append('fundingAmount', form.fundingAmount)
      fd.append('fundingUse', form.fundingUse)
      fd.append('ownsBusiness', String(form.ownsBusiness))
      fd.append('businessName', form.businessName)
      fd.append('fundingTimeframe', form.fundingTimeframe)
      fd.append('goalsNotes', form.goalsNotes)
      fd.append('businessProfile', JSON.stringify(form.businessProfile))
      fd.append('consent', JSON.stringify(form.consent))
      fd.append('typedSignature', form.typedSignature)
      fd.append('signatureDate', form.signatureDate)
      fd.append('uploadSessionId', session.sessionId)
      fd.append('uploadSessionToken', session.uploadToken)
      fd.append('stagedFiles', JSON.stringify(stagedFiles))
      if (inviteToken) {
        fd.append('inviteToken', inviteToken)
      }

      setUploadProgress(70)

      const intakeRes = await fetch('/api/credit-funding/intake', { method: 'POST', body: fd })
      const intakeData = await intakeRes.json().catch(() => ({}))
      if (!intakeRes.ok) {
        if (intakeRes.status === 413) {
          throw new Error('Upload too large. Use files under 4 MB each (PDF, JPG, or PNG).')
        }
        throw new Error(intakeData.error || 'Submission failed')
      }

      setUploadProgress(100)
      setApplicationId(intakeData.applicationId || '')
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white border border-brand-border rounded-2xl p-10 text-center shadow-sm">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="font-serif text-2xl font-bold text-brand-text mb-3">Application Submitted</h2>
        <p className="text-brand-muted mb-4">
          Thank you! We&apos;ve received your Credit &amp; Funding application and sent a confirmation to your email.
        </p>
        {applicationId && (
          <p className="inline-block px-4 py-2 bg-accent-soft border border-brand-border rounded-lg text-sm font-semibold text-brand-text">
            Application ID: {applicationId}
          </p>
        )}
        <p className="text-sm text-brand-muted mt-6">
          Track your application status anytime from your{' '}
          <Link href="/dashboard/credit-funding" className="text-accent font-semibold hover:underline">
            client portal
          </Link>{' '}
          (log in with the email you used to apply).
        </p>
      </div>
    )
  }

  if (inviteLoading) {
    return (
      <div className="bg-white border border-brand-border rounded-2xl p-10 text-center shadow-sm">
        <p className="text-sm text-brand-muted">Loading your application invitation…</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-brand-border rounded-2xl shadow-sm overflow-hidden">
      {inviteBanner && (
        <div className="px-6 py-4 bg-sky-50 border-b border-sky-200 text-sm text-sky-900">
          {inviteBanner}
        </div>
      )}
      {/* Progress */}
      <div className="px-6 pt-6 pb-4 border-b border-brand-border bg-brand-bg-soft">
        <WorkflowStepStrip steps={stepStripItems} layout="horizontal" />
        <p className="text-sm font-semibold text-brand-text mt-3">{stepStripItems[step]?.label}</p>
        <p className="text-xs text-brand-dim">Step {step + 1} of {stepStripItems.length}</p>
      </div>

      <div className="p-6 sm:p-8">
        {/* Step 1 */}
        {currentStepId === 'personal' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor={fid('fullName')}>Full Legal Name *</label>
              <input id={fid('fullName')} name="fullName" autoComplete="name" className={inputClass} value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
              {errors.fullName && <p className="text-xs text-brand-red mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('dateOfBirth')}>Date of Birth *</label>
              <input id={fid('dateOfBirth')} name="dateOfBirth" type="date" autoComplete="bday" className={inputClass} value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} />
              {errors.dateOfBirth && <p className="text-xs text-brand-red mt-1">{errors.dateOfBirth}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('ssn')}>Social Security Number *</label>
              <SsnInputField
                id={fid('ssn')}
                name="ssn"
                className={inputClass}
                value={form.ssn}
                onChange={(digits) => update('ssn', digits)}
                error={errors.ssn}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('email')}>Email Address *</label>
              <input
                id={fid('email')}
                name="email"
                type="email"
                autoComplete="email"
                className={`${inputClass}${inviteEmailLocked ? ' bg-neutral-100 cursor-not-allowed' : ''}`}
                value={form.email}
                readOnly={inviteEmailLocked}
                onChange={(e) => update('email', e.target.value)}
              />
              {inviteEmailLocked && (
                <p className="text-xs text-brand-dim mt-1">This email is tied to your invitation and cannot be changed.</p>
              )}
              {errors.email && <p className="text-xs text-brand-red mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('phone')}>Phone Number *</label>
              <input id={fid('phone')} name="phone" type="tel" autoComplete="tel" className={inputClass} value={form.phone} onChange={(e) => update('phone', e.target.value)} />
              {errors.phone && <p className="text-xs text-brand-red mt-1">{errors.phone}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor={fid('address')}>Home Address *</label>
              <input id={fid('address')} name="address" autoComplete="street-address" className={inputClass} value={form.address} onChange={(e) => update('address', e.target.value)} />
              {errors.address && <p className="text-xs text-brand-red mt-1">{errors.address}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('city')}>City *</label>
              <input id={fid('city')} name="city" autoComplete="address-level2" className={inputClass} value={form.city} onChange={(e) => update('city', e.target.value)} />
              {errors.city && <p className="text-xs text-brand-red mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('state')}>State *</label>
              <input id={fid('state')} name="state" autoComplete="address-level1" className={inputClass} maxLength={2} placeholder="NJ" value={form.state} onChange={(e) => update('state', e.target.value.toUpperCase())} />
              {errors.state && <p className="text-xs text-brand-red mt-1">{errors.state}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('zipCode')}>ZIP Code *</label>
              <input id={fid('zipCode')} name="zipCode" autoComplete="postal-code" className={inputClass} value={form.zipCode} onChange={(e) => update('zipCode', e.target.value)} />
              {errors.zipCode && <p className="text-xs text-brand-red mt-1">{errors.zipCode}</p>}
            </div>
          </div>
        )}

        {currentStepId === 'identity' && (
          <div>
            <DocumentUploadStep
              title="Identity Documents"
              subtitle="Upload each document on this step. Files are encrypted and stored securely as soon as you add them."
              documents={IDENTITY_DOCUMENTS}
              uploads={stagedUploads.uploads}
              onUpload={stagedUploads.uploadDocument}
              onRemove={stagedUploads.removeDocument}
            />
            {errors.documents && <p className="text-sm text-brand-red mt-4">{errors.documents}</p>}
          </div>
        )}

        {currentStepId === 'credit' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor={fid('creditScore')}>Current Credit Score (if known)</label>
              <input id={fid('creditScore')} name="creditScore" className={inputClass} placeholder="e.g. 650" value={form.creditProfile.creditScore || ''} onChange={(e) => updateCredit('creditScore', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('openCreditCards')}>Open Credit Cards</label>
              <input id={fid('openCreditCards')} name="openCreditCards" className={inputClass} type="number" min="0" value={form.creditProfile.openCreditCards || ''} onChange={(e) => updateCredit('openCreditCards', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('inquiries')}>Credit Inquiries</label>
              <input id={fid('inquiries')} name="inquiries" className={inputClass} type="number" min="0" value={form.creditProfile.inquiries || ''} onChange={(e) => updateCredit('inquiries', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('monthlyGrossIncome')}>Monthly Gross Income</label>
              <input id={fid('monthlyGrossIncome')} name="monthlyGrossIncome" className={inputClass} placeholder="$" value={form.creditProfile.monthlyGrossIncome || ''} onChange={(e) => updateCredit('monthlyGrossIncome', e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('annualIncome')}>Annual Income</label>
              <input id={fid('annualIncome')} name="annualIncome" className={inputClass} placeholder="$" value={form.creditProfile.annualIncome || ''} onChange={(e) => updateCredit('annualIncome', e.target.value)} />
            </div>
            {[
              { key: 'bankruptcy' as const, label: 'Have you ever filed bankruptcy?' },
              { key: 'collections' as const, label: 'Do you have any collections?' },
              { key: 'chargeOffs' as const, label: 'Do you have charge-offs?' },
              { key: 'latePayments24Months' as const, label: 'Late payments in the last 24 months?' },
              { key: 'employed' as const, label: 'Are you currently employed?' },
              { key: 'businessOwner' as const, label: 'Business Owner?' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg border border-brand-border">
                <span className="text-sm text-brand-muted">{label}</span>
                <div className="flex gap-3">
                  {[true, false].map((val) => (
                    <label key={String(val)} className="flex items-center gap-1 text-sm cursor-pointer">
                      <input
                        type="radio"
                        id={fid(`${key}-${val ? 'yes' : 'no'}`)}
                        name={fid(key)}
                        checked={form.creditProfile[key] === val}
                        onChange={() => updateCredit(key, val)}
                      />
                      {val ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4 */}
        {currentStepId === 'monitoring' && (
          <div>
            <div className="mb-5 p-4 bg-accent-soft/40 border border-brand-border rounded-xl text-sm text-brand-muted leading-relaxed">
              These services typically offer low-cost trial memberships. If you sign up, you may wish to cancel before any recurring subscription charges occur. Please review each provider&apos;s terms directly.
            </div>
            <div className="mb-4">
              <label className={labelClass} htmlFor={fid('selectedCreditProvider')}>Selected Provider *</label>
              <select id={fid('selectedCreditProvider')} name="selectedCreditProvider" className={inputClass} value={form.selectedCreditProvider} onChange={(e) => update('selectedCreditProvider', e.target.value)}>
                <option value="">Select a provider</option>
                {CREDIT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {errors.selectedCreditProvider && <p className="text-xs text-brand-red mt-1">{errors.selectedCreditProvider}</p>}
            </div>
            {form.selectedCreditProvider && (() => {
              const providerUrl = getCreditProviderSignupLink(form.selectedCreditProvider)
              if (!providerUrl) return null
              const linkAction = getCreditProviderLinkAction(form.selectedCreditProvider)
              const isLogin = linkAction === 'login'
              const providerName = form.selectedCreditProvider
              return (
                <div
                  className="mb-5 p-4 bg-sky-50 border border-sky-200 rounded-xl"
                  role="region"
                  aria-label={isLogin ? `Log in to ${providerName}` : `Sign up with ${providerName}`}
                >
                  <p className="text-sm font-semibold text-brand-text mb-1">
                    {isLogin ? `Log in to ${providerName} first` : `Sign up with ${providerName} first`}
                  </p>
                  <p className="text-sm text-brand-muted mb-3">
                    {isLogin
                      ? 'Access the CFPB consumer portal and sign in before entering your login credentials below.'
                      : 'Create your account with this provider before entering your login credentials below.'}
                  </p>
                  <a
                    href={providerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${isLogin ? 'Log in' : 'Sign up'} at ${providerName} (opens in a new tab)`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-brand-text text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
                  >
                    {isLogin ? `Log in at ${providerName}` : `Sign up at ${providerName}`}
                    <span aria-hidden="true">↗</span>
                  </a>
                  {creditProviderShowsTrialWarning(form.selectedCreditProvider) && (
                    <div
                      className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200/90 text-sm text-amber-950"
                      role="note"
                    >
                      <p className="font-semibold text-amber-950">Cancel your trial after signing up</p>
                      <p className="mt-1 text-amber-900/90 leading-relaxed">
                        Trial memberships convert to paid plans — often $25.99+ per month. Cancel right after you create your account to avoid recurring charges.
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}
            {form.selectedCreditProvider && (
              <>
                <div className="mb-4">
                  <label className={labelClass} htmlFor={fid('providerUsername')}>Username / Login Email *</label>
                  <input id={fid('providerUsername')} name="providerUsername" className={inputClass} value={form.providerUsername} onChange={(e) => update('providerUsername', e.target.value)} autoComplete="off" />
                  {errors.providerUsername && <p className="text-xs text-brand-red mt-1">{errors.providerUsername}</p>}
                </div>
                <div className="mb-4">
                  <label className={labelClass} htmlFor={fid('providerPassword')}>Password *</label>
                  <div className="relative">
                    <input
                      id={fid('providerPassword')}
                      name="providerPassword"
                      type={form.showPassword ? 'text' : 'password'}
                      className={inputClass}
                      value={form.providerPassword}
                      onChange={(e) => update('providerPassword', e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      aria-label={form.showPassword ? 'Hide provider password' : 'Show provider password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-dim hover:text-brand-text"
                      onClick={() => update('showPassword', !form.showPassword)}
                    >
                      {form.showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {errors.providerPassword && <p className="text-xs text-brand-red mt-1">{errors.providerPassword}</p>}
                </div>
                <div className="mb-5 pt-4 border-t border-brand-border">
                  <div
                    className="mb-4 p-4 bg-sky-50 border border-sky-200 rounded-xl"
                    role="region"
                    aria-label="Sign up with Experian.com"
                  >
                    <p className="text-sm font-semibold text-brand-text mb-1">Sign up with Experian.com first</p>
                    <p className="text-sm text-brand-muted mb-3">
                      Create your free Experian.com account before entering your credentials below.
                    </p>
                    <a
                      href={EXPERIAN_SIGNUP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Sign up at Experian.com (opens in a new tab)"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-brand-text text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
                    >
                      Sign up at Experian.com
                      <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                  <p className="text-sm font-semibold text-brand-text mb-3">Experian.com credentials</p>
                  <div className="mb-4">
                    <label className={labelClass} htmlFor={fid('experianEmail')}>Experian.com Email *</label>
                    <input
                      id={fid('experianEmail')}
                      name="experianEmail"
                      type="email"
                      className={inputClass}
                      value={form.experianEmail}
                      onChange={(e) => update('experianEmail', e.target.value)}
                      autoComplete="username"
                      placeholder="your@email.com"
                    />
                    {errors.experianEmail && <p className="text-xs text-brand-red mt-1">{errors.experianEmail}</p>}
                  </div>
                  <div className="mb-4">
                    <label className={labelClass} htmlFor={fid('experianPassword')}>Experian.com Password *</label>
                    <div className="relative">
                      <input
                        id={fid('experianPassword')}
                        name="experianPassword"
                        type={form.showExperianPassword ? 'text' : 'password'}
                        className={inputClass}
                        value={form.experianPassword}
                        onChange={(e) => update('experianPassword', e.target.value)}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        aria-label={form.showExperianPassword ? 'Hide Experian password' : 'Show Experian password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-dim hover:text-brand-text"
                        onClick={() => update('showExperianPassword', !form.showExperianPassword)}
                      >
                        {form.showExperianPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {errors.experianPassword && <p className="text-xs text-brand-red mt-1">{errors.experianPassword}</p>}
                  </div>
                </div>
              </>
            )}
            <p className="text-xs text-brand-dim italic">
              Your information will be encrypted and used solely for credit repair and funding analysis.
            </p>
          </div>
        )}

        {/* Step 5 */}
        {currentStepId === 'goals' && (
          <div>
            <div className="mb-4">
              <label className={labelClass} htmlFor={fid('primaryCreditGoalsText')}>What are your primary credit goals?</label>
              <textarea id={fid('primaryCreditGoalsText')} name="primaryCreditGoalsText" className={`${inputClass} min-h-[100px]`} value={form.primaryCreditGoalsText} onChange={(e) => update('primaryCreditGoalsText', e.target.value)} />
              {errors.primaryCreditGoalsText && <p className="text-xs text-brand-red mt-1">{errors.primaryCreditGoalsText}</p>}
            </div>
            <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CREDIT_GOAL_OPTIONS.map((goal) => (
                <label key={goal} htmlFor={fid(`goal-${goal}`)} className="flex items-center gap-2 text-sm text-brand-muted cursor-pointer p-2 rounded-lg hover:bg-neutral-50">
                  <input id={fid(`goal-${goal}`)} name="creditGoals" type="checkbox" checked={form.creditGoals.includes(goal)} onChange={() => toggleGoal(goal)} />
                  {goal}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass} htmlFor={fid('fundingAmount')}>How much funding are you seeking? *</label>
                <input id={fid('fundingAmount')} name="fundingAmount" className={inputClass} placeholder="e.g. $50,000" value={form.fundingAmount} onChange={(e) => update('fundingAmount', e.target.value)} />
                {errors.fundingAmount && <p className="text-xs text-brand-red mt-1">{errors.fundingAmount}</p>}
              </div>
              <div>
                <label className={labelClass} htmlFor={fid('fundingUse')}>Personal or business use? *</label>
                <select id={fid('fundingUse')} name="fundingUse" className={inputClass} value={form.fundingUse} onChange={(e) => update('fundingUse', e.target.value)}>
                  <option value="">Select</option>
                  <option value="Personal">Personal</option>
                  <option value="Business">Business</option>
                  <option value="Both">Both</option>
                </select>
                {errors.fundingUse && <p className="text-xs text-brand-red mt-1">{errors.fundingUse}</p>}
              </div>
              <div>
                <label className={labelClass} htmlFor={fid('ownsBusiness')}>Do you currently own a business?</label>
                <select id={fid('ownsBusiness')} name="ownsBusiness" className={inputClass} value={form.ownsBusiness ? 'yes' : 'no'} onChange={(e) => update('ownsBusiness', e.target.value === 'yes')}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {form.ownsBusiness && (
                <div>
                  <label className={labelClass} htmlFor={fid('businessName')}>Business Name *</label>
                  <input id={fid('businessName')} name="businessName" className={inputClass} value={form.businessName} onChange={(e) => update('businessName', e.target.value)} />
                  {errors.businessName && <p className="text-xs text-brand-red mt-1">{errors.businessName}</p>}
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor={fid('fundingTimeframe')}>Timeframe for funding *</label>
                <select id={fid('fundingTimeframe')} name="fundingTimeframe" className={inputClass} value={form.fundingTimeframe} onChange={(e) => update('fundingTimeframe', e.target.value)}>
                  <option value="">Select timeframe</option>
                  {FUNDING_TIMEFRAMES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {errors.fundingTimeframe && <p className="text-xs text-brand-red mt-1">{errors.fundingTimeframe}</p>}
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor={fid('goalsNotes')}>Tell us about your situation and goals</label>
              <textarea id={fid('goalsNotes')} name="goalsNotes" className={`${inputClass} min-h-[120px]`} value={form.goalsNotes} onChange={(e) => update('goalsNotes', e.target.value)} />
            </div>
          </div>
        )}

        {currentStepId === 'business-info' && (
          <BusinessInfoSection
            profile={form.businessProfile}
            onChange={(businessProfile) => update('businessProfile', businessProfile)}
            errors={errors}
          />
        )}

        {currentStepId === 'business-docs' && (
          <div>
            <DocumentUploadStep
              title="Business Documents"
              subtitle="Upload any documents you have available. You can add more later from your client portal if needed."
              documents={BUSINESS_DOCUMENTS}
              uploads={stagedUploads.uploads}
              onUpload={stagedUploads.uploadDocument}
              onRemove={stagedUploads.removeDocument}
            />
            {errors.documents && <p className="text-sm text-brand-red mt-4">{errors.documents}</p>}
          </div>
        )}

        {currentStepId === 'consent' && (
          <div>
            <div className="space-y-4 mb-6">
              {[
                { key: 'accurateInfo' as const, text: 'I certify all information provided is accurate.' },
                { key: 'authorizeReview' as const, text: 'I authorize Sunday Harmony to review my credit information.' },
              ].map(({ key, text }) => (
                <label key={key} htmlFor={fid(`consent-${key}`)} className="flex items-start gap-3 cursor-pointer">
                  <input
                    id={fid(`consent-${key}`)}
                    name={fid(`consent-${key}`)}
                    type="checkbox"
                    className="mt-1"
                    checked={form.consent[key]}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        consent: { ...prev.consent, [key]: e.target.checked },
                      }))
                    }
                  />
                  <span className="text-sm text-brand-muted">{text}</span>
                </label>
              ))}
              <label htmlFor={fid('consent-agreeTerms')} className="flex items-start gap-3 cursor-pointer">
                <input
                  id={fid('consent-agreeTerms')}
                  name={fid('consent-agreeTerms')}
                  type="checkbox"
                  className="mt-1"
                  checked={form.consent.agreeTerms}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      consent: { ...prev.consent, agreeTerms: e.target.checked },
                    }))
                  }
                />
                <span className="text-sm text-brand-muted">
                  I have read and agree to the{' '}
                  <Link href="/credit-funding/privacy" target="_blank" className="text-accent hover:underline">
                    Privacy Policy
                  </Link>{' '}
                  and authorize Sunday Harmony to process my information for credit repair and funding evaluation purposes.
                </span>
              </label>
              {errors.consent && <p className="text-xs text-brand-red">{errors.consent}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor={fid('typedSignature')}>Typed Signature *</label>
                <input id={fid('typedSignature')} name="typedSignature" className={inputClass} placeholder="Type your full legal name" value={form.typedSignature} onChange={(e) => update('typedSignature', e.target.value)} />
                {errors.typedSignature && <p className="text-xs text-brand-red mt-1">{errors.typedSignature}</p>}
              </div>
              <div>
                <label className={labelClass} htmlFor={fid('signatureDate')}>Date *</label>
                <input id={fid('signatureDate')} name="signatureDate" type="date" className={inputClass} value={form.signatureDate} onChange={(e) => update('signatureDate', e.target.value)} />
                {errors.signatureDate && <p className="text-xs text-brand-red mt-1">{errors.signatureDate}</p>}
              </div>
            </div>

            {submitting && (
              <div className="mt-6">
                <div className="flex justify-between text-xs text-brand-dim mb-1">
                  <span>Submitting application…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {submitError && (
          <p className="text-sm text-brand-red mt-4 px-1" role="alert">{submitError}</p>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-brand-border">
          <button
            type="button"
            onClick={back}
            disabled={step === 0 || submitting}
            className="px-5 py-2.5 text-sm font-medium text-brand-muted hover:text-brand-text disabled:opacity-40 transition-colors"
          >
            ← Back
          </button>
          {step < stepFlow.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="px-6 py-2.5 rounded-md bg-brand-text text-white font-semibold text-sm hover:bg-neutral-800 transition-all"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 rounded-md bg-brand-text text-white font-semibold text-sm hover:bg-neutral-800 disabled:opacity-60 transition-all"
            >
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
