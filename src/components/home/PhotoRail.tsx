'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { railOffset, railTravel } from '@/lib/rail-motion'
import { storyShot, storyShotIds } from '@/lib/work-photos'
import styles from './home.module.css'

export default function PhotoRail() {
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

    apply()
    reduce.addEventListener('change', apply)

    return () => {
      disposed = true
      stop()
      reduce.removeEventListener('change', apply)
    }
  }, [])

  return (
    <section className={styles.stage} id="work" ref={stage} data-rail="stack">
      <h2 className="sr-only">The work</h2>
      <div className={styles.railSticky}>
        <div className={styles.railView} ref={frame}>
          <ul className={styles.rail} ref={track}>
            {storyShotIds.map((id) => {
              const photo = storyShot(id)
              return (
                <li key={id} className={styles.shot}>
                  <figure>
                    <Image
                      className={styles.shotImg}
                      src={photo.src}
                      alt={photo.alt}
                      width={photo.width}
                      height={photo.height}
                      sizes="(min-width: 1024px) 46rem, 86vw"
                    />
                    <figcaption>{photo.label}</figcaption>
                  </figure>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
