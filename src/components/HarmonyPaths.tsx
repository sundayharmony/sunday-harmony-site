'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { brandMotion } from '@/lib/brand-tokens'
import styles from '@/components/home/home.module.css'

const paths = [
  {
    index: '01',
    eyebrow: 'Consulting',
    title: 'Build the business',
    body: 'Brand, strategy, and the systems the company runs on.',
    href: '/services',
    primary: true,
  },
  {
    index: '02',
    eyebrow: 'Business funding',
    title: 'Fund the business',
    body: 'Capital for owners who are ready for the next step.',
    href: '/funding',
    primary: false,
  },
  {
    index: '03',
    eyebrow: 'Personal credit',
    title: 'Strengthen personal credit',
    body: 'A clear read on your credit and a plan to improve creditworthiness.',
    href: '/credit?focus=credit',
    primary: false,
  },
] as const

export default function HarmonyPaths() {
  const reduce = useReducedMotion()

  return (
    <section className={styles.section} id="paths" aria-labelledby="harmony-paths-heading">
      <div className={styles.inner}>
        <h2 id="harmony-paths-heading" className={styles.title}>
          Choose a path
        </h2>
        <div className={styles.paths}>
          {paths.map((path) => (
            <motion.div
              key={path.title}
              className={styles.pathShift}
              whileHover={reduce ? undefined : { x: 8 }}
              transition={{ duration: brandMotion.durationMs / 1000, ease: brandMotion.ease }}
            >
              <Link href={path.href} className={styles.path}>
                <span className={styles.indexNum}>{path.index}</span>
                <span>
                  <span className={styles.pathTop}>
                    <p className={styles.eyebrow}>{path.eyebrow}</p>
                    {path.primary ? <span className={styles.badge}>Main practice</span> : null}
                  </span>
                  <h3 className={styles.pathTitle}>{path.title}</h3>
                  <p className={styles.pathBody}>{path.body}</p>
                </span>
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
        <p className={styles.note}>Owners who need funding, and people who want a clear read on their credit.</p>
      </div>
    </section>
  )
}
