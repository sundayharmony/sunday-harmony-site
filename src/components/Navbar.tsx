'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'

const navLinks = [
  { href: '/#services', label: 'Services' },
  { href: '/#packages', label: 'Packages' },
  { href: '/case-studies', label: 'Case Studies', isPage: true },
  { href: '/credit-funding', label: 'Credit & Funding', shortLabel: 'Credit', isPage: true },
  { href: '/#about', label: 'About', hideBelow: 'lg' as const },
  { href: '/#contact', label: 'Contact' },
]

const linkClass =
  'text-[11px] lg:text-[12px] xl:text-[13px] font-medium text-brand-muted tracking-wide hover:text-brand-text transition-colors whitespace-nowrap shrink-0'

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
        className={`fixed top-0 left-0 right-0 z-[1000] border-b border-brand-border backdrop-blur-xl transition-all duration-300 ${
          scrolled ? 'bg-[rgba(255,255,255,0.97)] shadow-sm' : 'bg-[rgba(255,255,255,0.9)]'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-5 md:px-6 flex items-center justify-between gap-3 h-[68px] md:h-[72px]">
          <BrandLogo height={38} priority />

          {/* Desktop Links */}
          <div className="hidden md:flex flex-nowrap items-center justify-end gap-2 lg:gap-3 xl:gap-4 min-w-0">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${linkClass}${link.hideBelow === 'lg' ? ' hidden lg:inline' : ''}`}
              >
                {'shortLabel' in link && link.shortLabel ? (
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
            <Link
              href="/#contact"
              className="shrink-0 px-4 lg:px-5 xl:px-6 py-2 lg:py-2.5 rounded-md bg-brand-text text-white font-semibold text-[11px] lg:text-[12px] xl:text-[13px] hover:bg-neutral-800 transition-all whitespace-nowrap"
            >
              Free Audit
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            ref={toggleRef}
            type="button"
            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] p-2 shrink-0"
            onClick={toggleMobile}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <div className={`w-[22px] h-0.5 bg-brand-text mb-[5px] transition-all ${mobileOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <div className={`w-[22px] h-0.5 bg-brand-text mb-[5px] transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
            <div className={`w-[22px] h-0.5 bg-brand-text transition-all ${mobileOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          ref={menuRef}
          id="mobile-nav"
          className="fixed top-[68px] md:top-[72px] left-0 right-0 bottom-0 bg-[rgba(255,255,255,0.98)] backdrop-blur-xl z-[999] p-7 flex flex-col gap-4 md:hidden"
        >
          {navLinks.map((link) => (
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
          <Link
            href="/#contact"
            onClick={closeMobile}
            className="text-lg font-semibold text-accent py-4"
          >
            Get Your Free Audit
          </Link>
        </div>
      )}
    </>
  )
}
