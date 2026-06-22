'use client'

import { useState } from 'react'
import FileUploadField from '@/components/credit-funding/FileUploadField'
import BusinessInfoSection, { type BusinessDocFiles } from '@/components/credit-funding/BusinessInfoSection'
import Link from 'next/link'
import {
  CREDIT_PROVIDERS,
  CREDIT_GOAL_OPTIONS,
  FUNDING_TIMEFRAMES,
  requiresBusinessSection,
  type CreditProfile,
  type ConsentData,
  type BusinessProfile,
} from '@/lib/credit-funding-types'

const STEPS = [
  'Personal Information',
  'Identity Verification',
  'Credit Profile',
  'Credit Monitoring',
  'Credit Goals',
  'Consent & Submit',
]

const inputClass =
  'w-full py-3 px-4 bg-neutral-50 border border-brand-border rounded-[10px] text-brand-text text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors'

const labelClass = 'block text-xs font-semibold text-brand-muted mb-1.5 tracking-wide'

interface FormState {
  fullName: string
  dateOfBirth: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zipCode: string
  photoId: File | null
  proofOfAddress: File | null
  selfieWithId: File | null
  mailProof: File | null
  creditProfile: CreditProfile
  selectedCreditProvider: string
  providerUsername: string
  providerPassword: string
  showPassword: boolean
  primaryCreditGoalsText: string
  creditGoals: string[]
  fundingAmount: string
  fundingUse: string
  ownsBusiness: boolean
  businessName: string
  fundingTimeframe: string
  goalsNotes: string
  businessProfile: BusinessProfile
  businessDocs: BusinessDocFiles
  consent: ConsentData
  typedSignature: string
  signatureDate: string
}

const initialState: FormState = {
  fullName: '',
  dateOfBirth: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  photoId: null,
  proofOfAddress: null,
  selfieWithId: null,
  mailProof: null,
  creditProfile: {},
  selectedCreditProvider: '',
  providerUsername: '',
  providerPassword: '',
  showPassword: false,
  primaryCreditGoalsText: '',
  creditGoals: [],
  fundingAmount: '',
  fundingUse: '',
  ownsBusiness: false,
  businessName: '',
  fundingTimeframe: '',
  goalsNotes: '',
  businessProfile: {},
  businessDocs: {},
  consent: { accurateInfo: false, authorizeReview: false, agreeTerms: false },
  typedSignature: '',
  signatureDate: new Date().toISOString().slice(0, 10),
}

export default function CreditFundingForm() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(initialState)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [applicationId, setApplicationId] = useState('')
  const [submitError, setSubmitError] = useState('')

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

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (!form.fullName.trim()) e.fullName = 'Required'
      if (!form.dateOfBirth) e.dateOfBirth = 'Required'
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required'
      if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) e.phone = 'Valid phone required'
      if (!form.address.trim()) e.address = 'Required'
      if (!form.city.trim()) e.city = 'Required'
      if (!form.state.trim() || form.state.length !== 2) e.state = '2-letter state code'
      if (!form.zipCode.trim() || !/^\d{5}(-\d{4})?$/.test(form.zipCode)) e.zipCode = 'Valid ZIP required'
    }
    if (s === 1) {
      if (!form.photoId) e.photoId = 'Government ID is required'
      if (!form.proofOfAddress) e.proofOfAddress = 'Proof of address is required'
      if (!form.mailProof) e.mailProof = 'Mail proof is required'
    }
    if (s === 3) {
      if (!form.selectedCreditProvider) e.selectedCreditProvider = 'Select a provider'
      if (!form.providerUsername.trim()) e.providerUsername = 'Required'
      if (!form.providerPassword || form.providerPassword.length < 4) e.providerPassword = 'Required'
    }
    if (s === 4) {
      if (!form.primaryCreditGoalsText.trim() && form.creditGoals.length === 0) {
        e.primaryCreditGoalsText = 'Describe your goals or select options below'
      }
      if (!form.fundingAmount.trim()) e.fundingAmount = 'Required'
      if (!form.fundingUse) e.fundingUse = 'Required'
      if (form.ownsBusiness && !form.businessName.trim()) e.businessName = 'Required'
      if (!form.fundingTimeframe) e.fundingTimeframe = 'Required'
      if (requiresBusinessSection(form.ownsBusiness, form.fundingUse, form.creditProfile)) {
        const bp = form.businessProfile
        if (!bp.legalName?.trim()) e.legalName = 'Required'
        if (!bp.ein?.trim()) e.ein = 'Required'
        if (!bp.address?.trim()) e.businessAddress = 'Required'
        if (!bp.city?.trim()) e.businessCity = 'Required'
        if (!bp.state?.trim() || bp.state.length !== 2) e.businessState = '2-letter state'
        if (!bp.industry?.trim()) e.industry = 'Required'
        if (!bp.entityType) e.entityType = 'Required'
        if (!bp.fundingPurposes?.length) e.fundingPurposes = 'Select at least one purpose'
      }
    }
    if (s === 5) {
      if (!form.consent.accurateInfo) e.consent = 'All consent items are required'
      if (!form.consent.authorizeReview) e.consent = 'All consent items are required'
      if (!form.consent.agreeTerms) e.consent = 'All consent items are required'
      if (!form.typedSignature.trim()) e.typedSignature = 'Signature required'
      if (!form.signatureDate) e.signatureDate = 'Date required'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const back = () => setStep((s) => Math.max(s - 1, 0))

  const handleSubmit = async () => {
    if (!validateStep(5)) return
    setSubmitting(true)
    setSubmitError('')
    setUploadProgress(0)

    const uploadSessionId = crypto.randomUUID()
    const stagedFiles: Array<{
      documentType: string
      storagePath: string
      file_name: string
      file_size: number
      file_type: string
      mime_type: string
      scan_status: string
    }> = []

    const filesToStage: Array<{ file: File; documentType: string; label: string }> = []
    if (form.photoId) filesToStage.push({ file: form.photoId, documentType: 'photo_id', label: 'Photo ID' })
    if (form.proofOfAddress) filesToStage.push({ file: form.proofOfAddress, documentType: 'proof_of_address', label: 'Proof of address' })
    if (form.selfieWithId) filesToStage.push({ file: form.selfieWithId, documentType: 'selfie_with_id', label: 'Selfie with ID' })
    if (form.mailProof) filesToStage.push({ file: form.mailProof, documentType: 'mail_proof', label: 'Mail proof' })
    for (const [docType, file] of Object.entries(form.businessDocs)) {
      if (file) filesToStage.push({ file, documentType: docType, label: docType.replace(/_/g, ' ') })
    }

    const totalSteps = filesToStage.length + 1
    let completedSteps = 0

    try {
      for (const item of filesToStage) {
        const stageFd = new FormData()
        stageFd.append('sessionId', uploadSessionId)
        stageFd.append('documentType', item.documentType)
        stageFd.append('file', item.file)

        const stageRes = await fetch('/api/credit-funding/stage', { method: 'POST', body: stageFd })
        const stageData = await stageRes.json().catch(() => ({}))
        if (!stageRes.ok) {
          throw new Error(stageData.error || `Failed to upload ${item.label}`)
        }
        stagedFiles.push(stageData.file)
        completedSteps += 1
        setUploadProgress(Math.round((completedSteps / totalSteps) * 100))
      }

      const fd = new FormData()
      fd.append('fullName', form.fullName)
      fd.append('dateOfBirth', form.dateOfBirth)
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
      fd.append('uploadSessionId', uploadSessionId)
      fd.append('stagedFiles', JSON.stringify(stagedFiles))

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

  return (
    <div className="bg-white border border-brand-border rounded-2xl shadow-sm overflow-hidden">
      {/* Progress */}
      <div className="px-6 pt-6 pb-4 border-b border-brand-border bg-brand-bg-soft">
        <div className="flex items-center justify-between mb-3 overflow-x-auto gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? 'bg-accent text-white' : i === step ? 'bg-brand-text text-white' : 'bg-neutral-200 text-brand-dim'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 sm:w-10 h-0.5 mx-1 ${i < step ? 'bg-accent' : 'bg-neutral-200'}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm font-semibold text-brand-text">{STEPS[step]}</p>
        <p className="text-xs text-brand-dim">Step {step + 1} of {STEPS.length}</p>
      </div>

      <div className="p-6 sm:p-8">
        {/* Step 1 */}
        {step === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass}>Full Legal Name *</label>
              <input className={inputClass} value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
              {errors.fullName && <p className="text-xs text-brand-red mt-1">{errors.fullName}</p>}
            </div>
            <div>
              <label className={labelClass}>Date of Birth *</label>
              <input type="date" className={inputClass} value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} />
              {errors.dateOfBirth && <p className="text-xs text-brand-red mt-1">{errors.dateOfBirth}</p>}
            </div>
            <div>
              <label className={labelClass}>Email Address *</label>
              <input type="email" className={inputClass} value={form.email} onChange={(e) => update('email', e.target.value)} />
              {errors.email && <p className="text-xs text-brand-red mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className={labelClass}>Phone Number *</label>
              <input type="tel" className={inputClass} value={form.phone} onChange={(e) => update('phone', e.target.value)} />
              {errors.phone && <p className="text-xs text-brand-red mt-1">{errors.phone}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Home Address *</label>
              <input className={inputClass} value={form.address} onChange={(e) => update('address', e.target.value)} />
              {errors.address && <p className="text-xs text-brand-red mt-1">{errors.address}</p>}
            </div>
            <div>
              <label className={labelClass}>City *</label>
              <input className={inputClass} value={form.city} onChange={(e) => update('city', e.target.value)} />
              {errors.city && <p className="text-xs text-brand-red mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className={labelClass}>State *</label>
              <input className={inputClass} maxLength={2} placeholder="NJ" value={form.state} onChange={(e) => update('state', e.target.value.toUpperCase())} />
              {errors.state && <p className="text-xs text-brand-red mt-1">{errors.state}</p>}
            </div>
            <div>
              <label className={labelClass}>ZIP Code *</label>
              <input className={inputClass} value={form.zipCode} onChange={(e) => update('zipCode', e.target.value)} />
              {errors.zipCode && <p className="text-xs text-brand-red mt-1">{errors.zipCode}</p>}
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 1 && (
          <div>
            <p className="text-sm text-brand-muted mb-6">
              Upload secure identity documents. All files are encrypted and stored in a private vault.
            </p>
            <FileUploadField label="Government Issued Photo ID" name="photoId" required value={form.photoId} onChange={(f) => update('photoId', f)} error={errors.photoId} />
            <FileUploadField label="Proof of Address" name="proofOfAddress" required value={form.proofOfAddress} onChange={(f) => update('proofOfAddress', f)} error={errors.proofOfAddress} />
            <FileUploadField label="Selfie Holding ID" name="selfieWithId" optional value={form.selfieWithId} onChange={(f) => update('selfieWithId', f)} />
            <FileUploadField label="Mail at Home Address (showing name & address)" name="mailProof" required value={form.mailProof} onChange={(f) => update('mailProof', f)} error={errors.mailProof} />
          </div>
        )}

        {/* Step 3 */}
        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Current Credit Score (if known)</label>
              <input className={inputClass} placeholder="e.g. 650" value={form.creditProfile.creditScore || ''} onChange={(e) => updateCredit('creditScore', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Open Credit Cards</label>
              <input className={inputClass} type="number" min="0" value={form.creditProfile.openCreditCards || ''} onChange={(e) => updateCredit('openCreditCards', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Credit Inquiries</label>
              <input className={inputClass} type="number" min="0" value={form.creditProfile.inquiries || ''} onChange={(e) => updateCredit('inquiries', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Monthly Gross Income</label>
              <input className={inputClass} placeholder="$" value={form.creditProfile.monthlyGrossIncome || ''} onChange={(e) => updateCredit('monthlyGrossIncome', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Annual Income</label>
              <input className={inputClass} placeholder="$" value={form.creditProfile.annualIncome || ''} onChange={(e) => updateCredit('annualIncome', e.target.value)} />
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
                        name={key}
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
        {step === 3 && (
          <div>
            <div className="mb-5 p-4 bg-accent-soft/40 border border-brand-border rounded-xl text-sm text-brand-muted leading-relaxed">
              These services typically offer low-cost trial memberships. If you sign up, you may wish to cancel before any recurring subscription charges occur. Please review each provider&apos;s terms directly.
            </div>
            <div className="mb-4">
              <label className={labelClass}>Selected Provider *</label>
              <select className={inputClass} value={form.selectedCreditProvider} onChange={(e) => update('selectedCreditProvider', e.target.value)}>
                <option value="">Select a provider</option>
                {CREDIT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {errors.selectedCreditProvider && <p className="text-xs text-brand-red mt-1">{errors.selectedCreditProvider}</p>}
            </div>
            <div className="mb-4">
              <label className={labelClass}>Username / Login Email *</label>
              <input className={inputClass} value={form.providerUsername} onChange={(e) => update('providerUsername', e.target.value)} autoComplete="off" />
              {errors.providerUsername && <p className="text-xs text-brand-red mt-1">{errors.providerUsername}</p>}
            </div>
            <div className="mb-4">
              <label className={labelClass}>Password *</label>
              <div className="relative">
                <input
                  type={form.showPassword ? 'text' : 'password'}
                  className={inputClass}
                  value={form.providerPassword}
                  onChange={(e) => update('providerPassword', e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-dim hover:text-brand-text"
                  onClick={() => update('showPassword', !form.showPassword)}
                >
                  {form.showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.providerPassword && <p className="text-xs text-brand-red mt-1">{errors.providerPassword}</p>}
            </div>
            <p className="text-xs text-brand-dim italic">
              Your information will be encrypted and used solely for credit repair and funding analysis.
            </p>
          </div>
        )}

        {/* Step 5 */}
        {step === 4 && (
          <div>
            <div className="mb-4">
              <label className={labelClass}>What are your primary credit goals?</label>
              <textarea className={`${inputClass} min-h-[100px]`} value={form.primaryCreditGoalsText} onChange={(e) => update('primaryCreditGoalsText', e.target.value)} />
              {errors.primaryCreditGoalsText && <p className="text-xs text-brand-red mt-1">{errors.primaryCreditGoalsText}</p>}
            </div>
            <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CREDIT_GOAL_OPTIONS.map((goal) => (
                <label key={goal} className="flex items-center gap-2 text-sm text-brand-muted cursor-pointer p-2 rounded-lg hover:bg-neutral-50">
                  <input type="checkbox" checked={form.creditGoals.includes(goal)} onChange={() => toggleGoal(goal)} />
                  {goal}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>How much funding are you seeking? *</label>
                <input className={inputClass} placeholder="e.g. $50,000" value={form.fundingAmount} onChange={(e) => update('fundingAmount', e.target.value)} />
                {errors.fundingAmount && <p className="text-xs text-brand-red mt-1">{errors.fundingAmount}</p>}
              </div>
              <div>
                <label className={labelClass}>Personal or business use? *</label>
                <select className={inputClass} value={form.fundingUse} onChange={(e) => update('fundingUse', e.target.value)}>
                  <option value="">Select</option>
                  <option value="Personal">Personal</option>
                  <option value="Business">Business</option>
                  <option value="Both">Both</option>
                </select>
                {errors.fundingUse && <p className="text-xs text-brand-red mt-1">{errors.fundingUse}</p>}
              </div>
              <div>
                <label className={labelClass}>Do you currently own a business?</label>
                <select className={inputClass} value={form.ownsBusiness ? 'yes' : 'no'} onChange={(e) => update('ownsBusiness', e.target.value === 'yes')}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {form.ownsBusiness && (
                <div>
                  <label className={labelClass}>Business Name *</label>
                  <input className={inputClass} value={form.businessName} onChange={(e) => update('businessName', e.target.value)} />
                  {errors.businessName && <p className="text-xs text-brand-red mt-1">{errors.businessName}</p>}
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={labelClass}>Timeframe for funding *</label>
                <select className={inputClass} value={form.fundingTimeframe} onChange={(e) => update('fundingTimeframe', e.target.value)}>
                  <option value="">Select timeframe</option>
                  {FUNDING_TIMEFRAMES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {errors.fundingTimeframe && <p className="text-xs text-brand-red mt-1">{errors.fundingTimeframe}</p>}
              </div>
            </div>
            <div>
              <label className={labelClass}>Tell us about your situation and goals</label>
              <textarea className={`${inputClass} min-h-[120px]`} value={form.goalsNotes} onChange={(e) => update('goalsNotes', e.target.value)} />
            </div>

            {requiresBusinessSection(form.ownsBusiness, form.fundingUse, form.creditProfile) && (
              <BusinessInfoSection
                profile={form.businessProfile}
                onChange={(businessProfile) => update('businessProfile', businessProfile)}
                docs={form.businessDocs}
                onDocChange={(type, file) =>
                  setForm((prev) => ({
                    ...prev,
                    businessDocs: { ...prev.businessDocs, [type]: file },
                  }))
                }
                errors={errors}
              />
            )}
          </div>
        )}

        {/* Step 6 */}
        {step === 5 && (
          <div>
            <div className="space-y-4 mb-6">
              {[
                { key: 'accurateInfo' as const, text: 'I certify all information provided is accurate.' },
                { key: 'authorizeReview' as const, text: 'I authorize Sunday Harmony to review my credit information.' },
              ].map(({ key, text }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer">
                  <input
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
              <label className="flex items-start gap-3 cursor-pointer">
                <input
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
                <label className={labelClass}>Typed Signature *</label>
                <input className={inputClass} placeholder="Type your full legal name" value={form.typedSignature} onChange={(e) => update('typedSignature', e.target.value)} />
                {errors.typedSignature && <p className="text-xs text-brand-red mt-1">{errors.typedSignature}</p>}
              </div>
              <div>
                <label className={labelClass}>Date *</label>
                <input type="date" className={inputClass} value={form.signatureDate} onChange={(e) => update('signatureDate', e.target.value)} />
                {errors.signatureDate && <p className="text-xs text-brand-red mt-1">{errors.signatureDate}</p>}
              </div>
            </div>

            {submitting && (
              <div className="mt-6">
                <div className="flex justify-between text-xs text-brand-dim mb-1">
                  <span>Uploading securely…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
            {submitError && <p className="text-sm text-brand-red mt-4">{submitError}</p>}
          </div>
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
          {step < STEPS.length - 1 ? (
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
