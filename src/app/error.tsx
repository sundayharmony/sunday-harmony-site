'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="font-serif text-2xl font-extrabold text-brand-text mb-3">
          Something Went Wrong
        </h1>
        <p className="text-sm text-brand-muted mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-br from-brand-gold to-[#b8944f] text-[#0a0a0f] text-sm font-bold hover:-translate-y-0.5 transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
