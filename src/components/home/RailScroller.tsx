'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './design.module.css'

/** Desktop pointer, enough height, motion allowed: vertical scroll drives the rail sideways. */
const PIN_QUERY = '(min-width: 1024px) and (min-height: 640px) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

/**
 * "One look" rail. On desktop the section pins while the page scrolls and the
 * tiles glide sideways in step with the (Lenis-smoothed) vertical scroll.
 * Phones and reduced-motion keep the native swipe rail.
 */
export default function RailScroller({ head, label, children }: { head: ReactNode; label: string; children: ReactNode }) {
  const sectionRef = useRef<HTMLElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    const rail = railRef.current
    if (!section || !rail) return
    const media = window.matchMedia(PIN_QUERY)
    let frame = 0
    let travel = 0

    const measure = () => {
      if (!media.matches) {
        travel = 0
        rail.style.transform = ''
        setDistance(0)
        return
      }
      const last = rail.lastElementChild as HTMLElement | null
      const padRight = parseFloat(getComputedStyle(rail).paddingLeft) || 0
      travel = last ? Math.max(0, last.offsetLeft + last.offsetWidth + padRight - rail.clientWidth) : 0
      setDistance(travel)
      update()
    }

    const update = () => {
      frame = 0
      if (!travel) return
      const box = section.getBoundingClientRect()
      const scrollable = section.offsetHeight - window.innerHeight
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, -box.top / scrollable)) : 0
      rail.style.transform = `translate3d(${(-progress * travel).toFixed(2)}px, 0, 0)`
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    media.addEventListener('change', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      media.removeEventListener('change', measure)
    }
  }, [])

  const pinned = distance > 0
  return (
    <section
      ref={sectionRef}
      className={`${styles.railSection} ${pinned ? styles.railPinned : ''}`}
      style={pinned ? { height: `calc(100vh + ${distance}px)` } : undefined}
      aria-labelledby="what-we-make"
    >
      <div className={pinned ? styles.railSticky : undefined}>
        {head}
        <div ref={railRef} className={styles.rail} tabIndex={pinned ? undefined : 0} aria-label={label}>
          {children}
        </div>
      </div>
    </section>
  )
}
