'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="font-serif text-2xl font-extrabold text-brand-text mb-3">
          Something Went Wrong
        </h1>
        <p className="text-sm text-brand-muted mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-lg bg-brand-gold text-white text-sm font-bold hover:-translate-y-0.5 transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
