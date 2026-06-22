import { CREDIT_FUNDING_MAX_MB } from '@/lib/credit-funding-types'

export default function DocumentUploadNotice() {
  return (
    <div
      className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-sm text-amber-950"
      role="alert"
    >
      <p className="font-semibold text-amber-950">Important — file size limit</p>
      <p className="mt-1.5 text-amber-900/90 leading-relaxed">
        Each document must be <strong>{CREDIT_FUNDING_MAX_MB} MB or smaller</strong> (PDF, JPG, or PNG).
        Phone photos are often too large. Before continuing, compress the image or save a smaller copy — otherwise
        your application cannot be submitted.
      </p>
    </div>
  )
}
