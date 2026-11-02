'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { packages } from '@/lib/data'

interface DocumentData {
  id: string
  document_type: 'agreement' | 'proposal'
  status: string
  document_number: string
  client_name: string
  business_name: string
  business_address?: string
  package_tier: string
  package_price: number
  price_type: 'one-time' | 'monthly' | 'custom'
  custom_scope?: string
  effective_date?: string
  client_signature?: string
  client_signature_type?: 'typed' | 'drawn'
  client_signed_at?: string
  signed_at?: string
}

export default function SignDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const fromDashboard = searchParams.get('from') === 'dashboard'
  
  const [docId, setDocId] = useState<string>('')
  const [document, setDocument] = useState<DocumentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn'>('typed')
  const [typedSignature, setTypedSignature] = useState('')
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  useEffect(() => {
    params.then(p => setDocId(p.id))
  }, [params])

  useEffect(() => {
    if (docId && (token || fromDashboard)) {
      fetchDocument()
    } else if (docId && !token && !fromDashboard) {
      setLoading(false)
      setError('Missing access token')
    }
  }, [docId, token, fromDashboard])

  async function fetchDocument() {
    try {
      const queryParams = token ? `token=${token}` : 'from=dashboard'
      const res = await fetch(`/api/sign/${docId}?${queryParams}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load document')
      }
      const data = await res.json()
      setDocument(data.document)
      if (data.document.status === 'signed') {
        setSigned(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    
    setIsDrawing(true)
    setHasDrawn(true)
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0a0a0a'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function stopDrawing() {
    setIsDrawing(false)
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function handleSign() {
    if (!document || (!token && !fromDashboard)) return
    
    let signature = ''
    if (signatureType === 'typed') {
      if (!typedSignature.trim()) {
        setError('Please type your name to sign')
        return
      }
      signature = typedSignature.trim()
    } else {
      if (!hasDrawn) {
        setError('Please draw your signature')
        return
      }
      signature = canvasRef.current?.toDataURL() || ''
    }

    setSigning(true)
    setError('')

    try {
      const queryParams = token ? `token=${token}` : 'from=dashboard'
      const res = await fetch(`/api/sign/${docId}?${queryParams}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature,
          signatureType,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to sign document')
      }

      setSigned(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-brand-muted">Loading document...</div>
      </div>
    )
  }

  if (error && !document) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-brand-text mb-4">Unable to Load Document</h1>
          <p className="text-brand-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!document) return null

  const pkg = packages.find(p => p.tier === document.package_tier)
  const docTypeLabel = document.document_type === 'agreement' ? 'Service Agreement' : 'Marketing Proposal'

  if (signed) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-white rounded-2xl border border-brand-border p-8">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl mx-auto mb-6">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-brand-text mb-3">Document Signed</h1>
          <p className="text-brand-muted mb-6">
            Thank you for signing the {docTypeLabel.toLowerCase()}. You will receive a confirmation email shortly.
          </p>
          <p className="text-sm text-brand-dim">
            Document: {document.document_number}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-accent font-serif text-2xl font-bold mb-2">SUNDAY HARMONY</div>
          <h1 className="text-3xl font-bold text-brand-text">{docTypeLabel}</h1>
          <p className="text-brand-muted mt-2">Document #{document.document_number}</p>
        </div>

        {/* Document Preview */}
        <div className="bg-white rounded-2xl border border-brand-border p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-brand-text mb-6 pb-4 border-b border-brand-border">
            Document Summary
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide mb-1">Client</div>
                <div className="text-brand-text font-medium">{document.client_name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide mb-1">Business</div>
                <div className="text-brand-text font-medium">{document.business_name}</div>
              </div>
            </div>

            <div className="pt-4 border-t border-brand-border">
              <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide mb-3">Package</div>
              <div className="rounded-lg border border-brand-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {pkg && <span className="text-2xl">{pkg.icon}</span>}
                    <div>
                      <div className="font-bold text-brand-text">{document.package_tier}</div>
                      <div className="text-sm text-brand-muted">{pkg?.tagline}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-brand-text">
                      ${document.package_price.toLocaleString()}
                    </div>
                    <div className="text-xs text-brand-dim">
                      {document.price_type === 'monthly' ? '/month' : document.price_type === 'one-time' ? 'one-time' : 'custom'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {pkg && (
              <div className="pt-4">
                <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide mb-2">What&apos;s Included</div>
                <ul className="space-y-1.5">
                  {pkg.features.filter(f => f.included).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-brand-muted">
                      <span className="text-accent mt-0.5">✓</span>
                      {feature.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {document.effective_date && (
              <div className="pt-4 border-t border-brand-border">
                <div className="text-xs font-semibold text-brand-dim uppercase tracking-wide mb-1">Effective Date</div>
                <div className="text-brand-text">
                  {new Date(document.effective_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legal Notice */}
        <div className="rounded-xl border border-accent/30 bg-accent-soft/30 p-4 mb-6">
          <p className="text-sm text-brand-muted">
            <strong className="text-brand-text">⚠️ Important:</strong> By signing below, you agree to the terms 
            outlined in this {docTypeLabel.toLowerCase()}. Have an attorney review before signing if you have questions.
          </p>
        </div>

        {/* Signature Section */}
        <div className="bg-white rounded-2xl border border-brand-border p-6 md:p-8">
          <h2 className="text-xl font-bold text-brand-text mb-6">Your Signature</h2>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-6">
              {error}
            </div>
          )}

          {/* Signature Type Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => setSignatureType('typed')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
                signatureType === 'typed'
                  ? 'bg-brand-text text-white'
                  : 'bg-neutral-100 text-brand-muted hover:bg-neutral-200'
              }`}
            >
              Type Name
            </button>
            <button
              type="button"
              onClick={() => setSignatureType('drawn')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
                signatureType === 'drawn'
                  ? 'bg-brand-text text-white'
                  : 'bg-neutral-100 text-brand-muted hover:bg-neutral-200'
              }`}
            >
              Draw Signature
            </button>
          </div>

          {signatureType === 'typed' ? (
            <div className="mb-6">
              <label className="block text-sm font-medium text-brand-text mb-2">
                Type your full legal name
              </label>
              <input
                type="text"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                className="w-full px-4 py-3 border border-brand-border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder={document.client_name}
              />
              {typedSignature && (
                <div className="mt-4 p-4 border border-brand-border rounded-lg bg-neutral-50">
                  <div className="text-xs text-brand-dim mb-2">Signature preview:</div>
                  <div className="font-serif text-2xl italic text-brand-text">{typedSignature}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6">
              <label className="block text-sm font-medium text-brand-text mb-2">
                Draw your signature below
              </label>
              <div className="border border-brand-border rounded-lg overflow-hidden bg-white">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={150}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <button
                type="button"
                onClick={clearCanvas}
                className="mt-2 text-sm text-brand-muted hover:text-brand-text"
              >
                Clear signature
              </button>
            </div>
          )}

          <div className="text-xs text-brand-dim mb-6">
            By clicking &quot;Sign Document&quot;, you agree that your electronic signature is the legal equivalent 
            of your handwritten signature. Your IP address and timestamp will be recorded.
          </div>

          <button
            type="button"
            onClick={handleSign}
            disabled={signing}
            className="w-full py-3.5 rounded-lg bg-brand-text text-white font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {signing ? 'Signing...' : 'Sign Document'}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-brand-dim">
          <p>Sunday Harmony Consulting</p>
          <p>Brand, strategy, and systems. · sundayharmony.com</p>
        </div>
      </div>
    </div>
  )
}
