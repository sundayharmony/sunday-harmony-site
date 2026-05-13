'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const navLinks = [
  { href: '#services', label: 'Services' },
  { href: '#packages', label: 'Packages' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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

  const closeMobile = () => setMobileOpen(false)

  const toggleMobile = () => setMobileOpen((open) => !open)

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[1000] border-b border-brand-border backdrop-blur-xl transition-all duration-300 ${
          scrolled ? 'bg-[rgba(255,255,255,0.97)] shadow-sm' : 'bg-[rgba(255,255,255,0.9)]'
        }`}
      >
        <div className="max-w-[1100px] mx-auto px-7 flex items-center justify-between h-[72px]">
          <Link href="/" className="font-serif text-[22px] font-extrabold text-brand-text tracking-wide">
            Sunday <span className="text-accent">Harmony</span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex gap-9 items-center">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-brand-muted tracking-wide hover:text-brand-text transition-colors"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="text-[13px] font-medium text-brand-muted tracking-wide hover:text-brand-text transition-colors"
            >
              Login
            </Link>
            <a
              href="#contact"
              className="px-6 py-2.5 rounded-md bg-brand-text text-white font-semibold text-[13px] hover:bg-neutral-800 transition-all"
            >
              Free Audit
            </a>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2"
            onClick={toggleMobile}
            aria-label="Menu"
          >
            <div className={`w-[22px] h-0.5 bg-brand-text mb-[5px] transition-all ${mobileOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <div className={`w-[22px] h-0.5 bg-brand-text mb-[5px] transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
            <div className={`w-[22px] h-0.5 bg-brand-text transition-all ${mobileOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed top-[72px] left-0 right-0 bottom-0 bg-[rgba(255,255,255,0.98)] backdrop-blur-xl z-[999] p-7 flex flex-col gap-4 md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={closeMobile}
              className="text-lg font-medium text-brand-muted py-4 border-b border-brand-border"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            onClick={closeMobile}
            className="text-lg font-medium text-brand-muted py-4 border-b border-brand-border"
          >
            Login
          </Link>
          <a
            href="#contact"
            onClick={closeMobile}
            className="text-lg font-semibold text-accent py-4"
          >
            Get Your Free Audit
          </a>
        </div>
      )}
    </>
  )
}
