'use client'

import { useEffect, useState } from 'react'
import styles from './home.module.css'

const chapters = [
  { id: 'hero', label: 'Start' },
  { id: 'paths', label: 'Paths' },
  { id: 'services', label: 'Consulting' },
  { id: 'process', label: 'Steps' },
  { id: 'start', label: 'Audit' },
] as const

export default function HomeIndex() {
  const [active, setActive] = useState<(typeof chapters)[number]['id']>('hero')

  useEffect(() => {
    const nodes = chapters
      .map((chapter) => document.getElementById(chapter.id))
      .filter((node): node is HTMLElement => Boolean(node))
    const seen = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const id = hit?.target.id
        if (id === 'hero' || id === 'paths' || id === 'services' || id === 'process' || id === 'start') {
          setActive(id)
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0.1, 0.4] }
    )
    nodes.forEach((node) => seen.observe(node))
    return () => seen.disconnect()
  }, [])

  return (
    <nav className={styles.index} aria-label="On this page">
      <div className={styles.indexList}>
        {chapters.map((chapter) => (
          <a key={chapter.id} href={`#${chapter.id}`} aria-current={active === chapter.id ? 'true' : undefined}>
            {chapter.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
