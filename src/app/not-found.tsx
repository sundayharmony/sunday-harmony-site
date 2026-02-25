import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl font-extrabold text-brand-gold mb-4">404</div>
        <h1 className="font-serif text-2xl font-extrabold text-brand-text mb-3">
          Page Not Found
        </h1>
        <p className="text-sm text-brand-muted mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg bg-gradient-to-br from-brand-gold to-[#b8944f] text-[#0a0a0f] text-sm font-bold hover:-translate-y-0.5 transition-all"
          >
            Go Home
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-brand-text text-sm font-medium hover:bg-[rgba(255,255,255,0.08)] transition-all"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  )
}
