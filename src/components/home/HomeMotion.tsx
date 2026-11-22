'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import gsap from 'gsap'
import { brandMotion, homeThemeVars } from '@/lib/brand-tokens'
import 'lenis/dist/lenis.css'
import styles from './home.module.css'

export default function HomeMotion({ children }: { children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = bar.current
    if (!node) return

    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarseQuery = window.matchMedia('(pointer: coarse)')
    const html = document.documentElement
    const previousScroll = html.style.scrollBehavior
    let frame = 0
    let disposed = false
    let starting = false
    let ticket = 0
    let lenis: { destroy: () => void } | null = null

    const paint = () => {
      const max = html.scrollHeight - window.innerHeight
      const scaleX = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      if (reduceQuery.matches) {
        gsap.set(node, { scaleX })
        return
      }
      gsap.to(node, {
        scaleX,
        duration: brandMotion.progressMs / 1000,
        ease: 'power2.out',
        overwrite: true,
      })
    }

    const allowed = () => !reduceQuery.matches && !coarseQuery.matches && window.innerWidth >= 768

    const stopLenis = () => {
      ticket += 1
      starting = false
      cancelAnimationFrame(frame)
      frame = 0
      lenis?.destroy()
      lenis = null
      html.style.scrollBehavior = previousScroll
    }

    // shortcut: Lenis off for reduced motion, touch, and viewports under 768px.
    const syncLenis = () => {
      if (!allowed()) {
        stopLenis()
        return
      }
      if (lenis || starting) return
      starting = true
      const mine = ticket
      html.style.scrollBehavior = 'auto'
      void import('lenis').then(({ default: Lenis }) => {
        starting = false
        if (disposed || mine !== ticket || !allowed()) return
        const instance = new Lenis({
          lerp: brandMotion.lenisLerp,
          wheelMultiplier: brandMotion.wheelMultiplier,
          smoothWheel: true,
          anchors: { offset: -128 },
        })
        lenis = instance
        instance.on('scroll', paint)
        const loop = (time: number) => {
          instance.raf(time)
          frame = requestAnimationFrame(loop)
        }
        frame = requestAnimationFrame(loop)
      })
    }

    gsap.set(node, { scaleX: 0, transformOrigin: 'left center' })
    paint()
    syncLenis()
    window.addEventListener('scroll', paint, { passive: true })
    window.addEventListener('resize', syncLenis)
    reduceQuery.addEventListener('change', syncLenis)
    coarseQuery.addEventListener('change', syncLenis)

    return () => {
      disposed = true
      stopLenis()
      window.removeEventListener('scroll', paint)
      window.removeEventListener('resize', syncLenis)
      reduceQuery.removeEventListener('change', syncLenis)
      coarseQuery.removeEventListener('change', syncLenis)
      gsap.killTweensOf(node)
    }
  }, [])

  return (
    <div className={styles.home} style={homeThemeVars() as CSSProperties}>
      <div className={styles.progress} aria-hidden="true">
        <div ref={bar} className={styles.progressBar} />
      </div>
      {children}
    </div>
  )
}
