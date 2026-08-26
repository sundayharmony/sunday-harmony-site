import type { ReactNode } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import BrandLogo from '@/components/BrandLogo'

interface Props {
  label?: string
  title: ReactNode
  description?: string
  hero?: ReactNode
  children: ReactNode
  maxWidthClass?: string
  minimalHeader?: boolean
}

function MinimalHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-[1000] border-b border-brand-border bg-white pt-[env(safe-area-inset-top,0px)]">
      <div className="flex items-center justify-center h-[var(--nav-bar-height)]">
        <BrandLogo height={38} priority />
      </div>
    </header>
  )
}

export default function PublicPageLayout({
  label,
  title,
  description,
  hero,
  children,
  maxWidthClass = 'max-w-[1100px]',
  minimalHeader = false,
}: Props) {
  return (
    <>
      {minimalHeader ? <MinimalHeader /> : <Navbar />}
      <main className="pt-[var(--nav-total-height)] min-h-screen bg-brand-bg-soft">
        <section className="py-16 sm:py-20">
          <div className={`${maxWidthClass} mx-auto px-7`}>
            {label && <div className="section-label">{label}</div>}
            <h1 className="font-serif text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.12] text-brand-text mb-4">
              {title}
            </h1>
            {description && (
              <p className="text-[15px] text-brand-muted mb-10 leading-relaxed max-w-[640px]">{description}</p>
            )}
            {hero}
            {children}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
