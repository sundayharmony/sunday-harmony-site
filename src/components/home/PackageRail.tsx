'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { packageDisclaimer, packagePriceDisplay, packages, type Package } from '@/lib/data'
import { railOffset, railTravel } from '@/lib/rail-motion'
import styles from './home.module.css'

function priceNote(pkg: Package): string {
  if (pkg.priceSuffix === 'monthly') return 'per month'
  if (pkg.priceSuffix === 'one-time') return 'one-time'
  return 'quoted'
}

function cardHref(pkg: Package): string {
  return pkg.priceSuffix === 'quote' ? '/book' : '/services#packages'
}

function cardCta(pkg: Package): string {
  if (pkg.popular) return 'Start with Launch'
  return pkg.ctaLabel ?? "See what's included"
}

export default function PackageRail() {
  const stage = useRef<HTMLElement>(null)
  const track = useRef<HTMLUListElement>(null)
  const frame = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = stage.current
    const row = track.current
    const view = frame.current
    if (!section || !row || !view) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let distance = 0
    let top = 0
    let span = 0
    let raf = 0
    let pending = 0
    let listening = false
    let disposed = false

    const measure = () => {
      const rect = section.getBoundingClientRect()
      top = rect.top + window.scrollY
      span = Math.max(0, rect.height - window.innerHeight)
      distance = railTravel(row.scrollWidth, view.clientWidth)
    }

    const paint = () => {
      raf = 0
      if (disposed || section.dataset.rail !== 'scroll') return
      const progress = span > 0 ? Math.min(1, Math.max(0, (window.scrollY - top) / span)) : 0
      row.style.transform = `translate3d(${railOffset(progress, distance)}px,0,0)`
    }

    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(paint)
    }

    const onResize = () => {
      if (section.dataset.rail !== 'scroll') return
      measure()
      paint()
    }

    const stop = () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(pending)
      raf = 0
      pending = 0
      observer.disconnect()
      if (!listening) return
      listening = false
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }

    const apply = () => {
      stop()
      row.style.transform = ''
      if (reduce.matches) {
        section.dataset.rail = 'stack'
        return
      }
      section.dataset.rail = 'scroll'
      pending = requestAnimationFrame(() => {
        if (disposed || section.dataset.rail !== 'scroll') return
        measure()
        paint()
        if (listening) return
        listening = true
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onResize)
        observer.observe(view)
        observer.observe(row)
      })
    }

    const observer = new ResizeObserver(() => {
      if (disposed || section.dataset.rail !== 'scroll') return
      measure()
      paint()
    })

    const onFocusIn = (event: Event) => {
      if (section.dataset.rail !== 'scroll') return
      const card = (event.target as HTMLElement | null)?.closest('li')
      if (!card || !row.contains(card)) return
      const cards = [...row.children]
      const index = cards.indexOf(card)
      if (index < 0) return
      measure()
      const progress = cards.length <= 1 ? 0 : index / (cards.length - 1)
      window.scrollTo({ top: top + progress * span, behavior: 'auto' })
    }

    apply()
    reduce.addEventListener('change', apply)
    row.addEventListener('focusin', onFocusIn)

    return () => {
      disposed = true
      stop()
      reduce.removeEventListener('change', apply)
      row.removeEventListener('focusin', onFocusIn)
    }
  }, [])

  return (
    <section className={styles.stage} id="packages" ref={stage} data-rail="stack">
      <div className={styles.railSticky}>
        <div className={styles.inner}>
          <div className={styles.label}>Ways to start</div>
          <h2 className={styles.title}>
            The price is on <em>the card.</em>
          </h2>
          <p className={styles.deck}>
            Essentials is the brand. Launch adds the site. Marketing Partner stays month to month. Custom is quoted.
            Not sure which one? Start with the free audit.
          </p>
          <div className={styles.railView} ref={frame}>
            <ul className={styles.rail} ref={track}>
              {packages.map((pkg) => (
                <li key={pkg.tier} className={pkg.popular ? styles.railCardPopular : styles.railCard}>
                  {pkg.popular ? <p className={styles.badge}>Most owners start here</p> : null}
                  <p className={styles.eyebrow}>{pkg.tagline}</p>
                  <h3>{pkg.tier}</h3>
                  <p className={styles.railPrice}>
                    {packagePriceDisplay(pkg)} <span>{priceNote(pkg)}</span>
                  </p>
                  <p>{pkg.ideal}</p>
                  <Link href={cardHref(pkg)}>{cardCta(pkg)}</Link>
                </li>
              ))}
            </ul>
          </div>
          <p className={styles.note}>{packageDisclaimer}</p>
        </div>
      </div>
    </section>
  )
}
