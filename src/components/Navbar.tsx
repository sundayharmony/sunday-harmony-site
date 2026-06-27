'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'
import AuditCtaButton from '@/components/ui/AuditCtaButton'
import { siteNavLinks } from '@/lib/navigation'

const linkClass =
  'text-[11px] lg:text-[12px] xl:text-[13px] font-medium text-brand-muted tracking-wide hover:text-brand-text transition-colors whitespace-nowrap shrink-0'

function MenuIcon({ open }: { open: boolean }) {
  return (
    <span className="relative flex h-[18px] w-[22px] flex-col items-center justify-between" aria-hidden="true">
      <span
        className={`block h-0.5 w-full rounded-full bg-brand-text transition-all duration-200 ${
          open ? 'translate-y-[8px] rotate-45' : ''
        }`}
      />
      <span
        className={`block h-0.5 w-full rounded-full bg-brand-text transition-all duration-200 ${
          open ? 'scale-x-0 opacity-0' : ''
        }`}
      />
      <span
        className={`block h-0.5 w-full rounded-full bg-brand-text transition-all duration-200 ${
          open ? '-translate-y-[8px] -rotate-45' : ''
        }`}
      />
    </span>
  )
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        toggleRef.current?.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const firstFocusable = menuRef.current?.querySelector<HTMLElement>('a, button')
    firstFocusable?.focus()

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  const closeMobile = () => setMobileOpen(false)

  const toggleMobile = () => setMobileOpen((open) => !open)

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[1000] border-b border-brand-border backdrop-blur-xl transition-all duration-300 pt-[env(safe-area-inset-top,0px)] ${
          scrolled ? 'bg-[rgba(255,255,255,0.97)] shadow-sm' : 'bg-[rgba(255,255,255,0.9)]'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-5 md:px-6 flex items-center justify-between md:relative md:justify-center h-[var(--nav-bar-height)]">
          <div className="shrink-0 md:absolute md:left-6 md:top-1/2 md:-translate-y-1/2 z-10">
            <div className="md:hidden">
              <BrandLogo height={30} priority />
            </div>
            <div className="hidden md:block">
              <BrandLogo height={38} priority />
            </div>
          </div>

          <div className="hidden md:flex flex-nowrap items-center justify-center gap-4 lg:gap-5 xl:gap-7 2xl:gap-8 px-[140px] lg:px-[160px] xl:px-[200px]">
            {siteNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${linkClass}${link.hideBelow === 'lg' ? ' hidden lg:inline' : ''}`}
              >
                {link.shortLabel ? (
                  <>
                    <span className="xl:hidden">{link.shortLabel}</span>
                    <span className="hidden xl:inline">{link.label}</span>
                  </>
                ) : (
                  link.label
                )}
              </Link>
            ))}
            <Link href="/login" className={`${linkClass} hidden lg:inline`}>
              Login
            </Link>
          </div>

          <div className="absolute right-5 md:right-6 top-1/2 -translate-y-1/2 hidden md:block">
            <AuditCtaButton variant="nav" />
          </div>

          <button
            ref={toggleRef}
            type="button"
            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] p-2 shrink-0 -mr-1"
            onClick={toggleMobile}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div
          ref={menuRef}
          id="mobile-nav"
          className="fixed top-[var(--nav-total-height)] left-0 right-0 bottom-0 bg-[rgba(255,255,255,0.98)] backdrop-blur-xl z-[999] px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-1 md:hidden overflow-y-auto"
        >
          {siteNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMobile}
              className="text-lg font-medium text-brand-muted py-4 border-b border-brand-border"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={closeMobile}
            className="text-lg font-medium text-brand-muted py-4 border-b border-brand-border"
          >
            Login
          </Link>
          <AuditCtaButton variant="mobile" onClick={closeMobile} />
        </div>
      )}
    </>
  )
}
