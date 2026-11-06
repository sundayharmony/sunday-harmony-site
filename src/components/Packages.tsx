'use client'

import Link from 'next/link'
import { useState } from 'react'
import { packages, packagePriceDisplay, packageDisclaimer, type Package } from '@/lib/data'

const taglineColor: Record<string, string> = {
  blue: 'text-brand-muted',
  green: 'text-brand-muted',
  gold: 'text-accent',
  purple: 'text-brand-muted',
}

const offerings = [
  {
    tier: 'Business Essentials',
    body: 'A polished brand identity: logo, colors, typography, guidelines, and social assets.',
    best: 'Businesses launching or refreshing their brand',
    handsOn: 2,
    reach: 1,
  },
  {
    tier: 'Business Launch',
    body: 'Brand identity plus a website, SEO basics, Google Business, and launch graphics.',
    best: 'Businesses ready to go live with a professional presence',
    handsOn: 3,
    reach: 3,
  },
  {
    tier: 'Marketing Partner',
    body: 'Ongoing strategy, social content, website updates, and SEO to keep the momentum.',
    best: 'Businesses that want steady marketing support',
    handsOn: 4,
    reach: 4,
  },
  {
    tier: 'Custom Solutions',
    body: 'E-commerce, apps, print, apparel, wraps, ads, systems — scoped to the project.',
    best: 'Businesses with specialized or larger-scale needs',
    handsOn: 5,
    reach: 5,
  },
] as const

function hoverPointer(pointerType: string): boolean {
  return pointerType === 'mouse' || pointerType === 'pen'
}

function priceSuffixLabel(pkg: Package): string | null {
  if (pkg.priceSuffix === 'one-time') return 'one-time'
  if (pkg.priceSuffix === 'monthly') return '/month'
  if (pkg.priceSuffix === 'quote') return null
  if (pkg.price != null) return '/month'
  return null
}

function facePrice(pkg: Package): string {
  const label = packagePriceDisplay(pkg)
  if (pkg.priceSuffix === 'one-time') return `${label} one-time`
  if (pkg.priceSuffix === 'monthly') return `${label}/mo`
  return label
}

function DotMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-dim">{label}</span>
      <span className="flex shrink-0 gap-1" role="img" aria-label={`${label} ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((dot) => (
          <span
            key={dot}
            className={`h-1.5 w-3.5 rounded-full ${dot <= value ? 'bg-accent' : 'bg-neutral-200'}`}
          />
        ))}
      </span>
    </div>
  )
}

export default function Packages() {
  const [openTier, setOpenTier] = useState<string | null>(null)

  return (
    <div>
      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-4">
        {offerings.map((option) => {
          const pkg = packages.find((item) => item.tier === option.tier)
          if (!pkg) return null
          const open = openTier === pkg.tier
          const included = pkg.features.filter((feat) => feat.included)
          const suffix = priceSuffixLabel(pkg)
          return (
            <article
              key={pkg.tier}
              className="group relative grid items-start"
              onPointerEnter={(event) => {
                if (hoverPointer(event.pointerType)) setOpenTier(pkg.tier)
              }}
              onPointerLeave={(event) => {
                if (!hoverPointer(event.pointerType)) return
                if (!(event.relatedTarget instanceof Node)) return
                setOpenTier((current) => (current === pkg.tier ? null : current))
              }}
            >
              <div
                className={`col-start-1 row-start-1 flex flex-col rounded-2xl bg-white ${
                  pkg.popular ? 'border-2 border-brand-text shadow-sm' : 'border border-brand-border'
                } ${open ? '' : 'hidden'}`}
              >
                {pkg.popular && (
                  <div className="py-1.5 text-center text-[10px] font-bold tracking-[0.14em] uppercase bg-brand-text text-white rounded-t-2xl">
                    Most Popular
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="text-2xl mb-2">{pkg.icon}</div>
                  <div className="text-base font-bold text-brand-text mb-1">{pkg.tier}</div>
                  <div className={`text-xs font-semibold mb-3 ${taglineColor[pkg.color] || 'text-brand-muted'}`}>
                    {pkg.tagline}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-serif text-2xl font-extrabold text-brand-text">
                      {packagePriceDisplay(pkg)}
                    </span>
                    {suffix && <span className="text-[11px] text-brand-dim">{suffix}</span>}
                  </div>
                  <p className="text-[11px] text-brand-dim leading-snug mb-4">{pkg.ideal}</p>
                  <div className="border-t border-brand-border pt-3">
                    {included.map((feat) => (
                      <div key={feat.text} className="flex gap-2 mb-1.5 text-[11px] leading-snug">
                        <span className="flex-shrink-0 mt-px text-brand-text">✓</span>
                        <span className="text-brand-muted">{feat.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto flex flex-col gap-2 pt-4">
                    <Link
                      href="/book"
                      tabIndex={open ? 0 : -1}
                      aria-hidden={!open}
                      className={`block w-full py-2.5 rounded-lg text-center text-[12px] font-semibold transition-all ${
                        pkg.popular
                          ? 'bg-brand-text text-white font-bold hover:bg-neutral-800'
                          : 'border border-brand-border text-brand-text hover:bg-neutral-50'
                      }`}
                    >
                      {pkg.ctaLabel ?? 'Get Started'}
                    </Link>
                    <button
                      type="button"
                      id={`package-back-${pkg.tier}`}
                      tabIndex={open ? 0 : -1}
                      aria-hidden={!open}
                      className="w-full py-2 text-[12px] font-semibold text-brand-muted hover:text-brand-text"
                      onClick={() => {
                        setOpenTier((current) => (current === pkg.tier ? null : current))
                        document.getElementById(`package-reveal-${pkg.tier}`)?.focus({ preventScroll: true })
                      }}
                    >
                      Back to overview
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`col-start-1 row-start-1 z-10 flex flex-col rounded-2xl border border-brand-border bg-white p-6 shadow-sm sm:p-7 ${
                  open ? 'hidden' : ''
                }`}
                onClick={() => setOpenTier(pkg.tier)}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-accent-soft text-[22px]">
                    {pkg.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-brand-text leading-tight">{option.tier}</h3>
                    <p className="whitespace-nowrap text-xs font-semibold text-accent">{facePrice(pkg)}</p>
                  </div>
                </div>
                <p className="text-sm text-brand-muted leading-relaxed mb-4">{option.body}</p>
                <div className="mb-5 rounded-lg bg-neutral-50 border border-brand-border px-3 py-2 text-xs text-brand-muted">
                  <span className="font-semibold text-brand-text">Best for: </span>
                  {option.best}
                </div>
                <div className="space-y-2.5">
                  <DotMeter label="Hands-on" value={option.handsOn} />
                  <DotMeter label="Reach" value={option.reach} />
                </div>
                <button
                  type="button"
                  id={`package-reveal-${pkg.tier}`}
                  aria-expanded={open}
                  tabIndex={open ? -1 : 0}
                  className="mt-auto w-full pt-5 text-left text-xs font-semibold text-accent hover:underline"
                  onClick={(event) => {
                    event.stopPropagation()
                    setOpenTier(pkg.tier)
                    requestAnimationFrame(() => {
                      document.getElementById(`package-back-${pkg.tier}`)?.focus({ preventScroll: true })
                    })
                  }}
                >
                  See what&apos;s included
                </button>
              </div>
            </article>
          )
        })}
      </div>
      <p className="mt-6 text-xs text-brand-dim">
        Hover a package, or tap See what&apos;s included, to view the full price and checklist.
      </p>
      <p className="mt-2 text-xs text-brand-dim">{packageDisclaimer}</p>
    </div>
  )
}
