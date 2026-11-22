'use client'

import { motion, useReducedMotion } from 'motion/react'
import { services } from '@/lib/data'
import { brandMotion } from '@/lib/brand-tokens'
import styles from '@/components/home/home.module.css'

export default function Services() {
  const reduce = useReducedMotion()

  return (
    <section className={`${styles.section} ${styles.soft}`} id="services">
      <div className={styles.inner}>
        <div className={styles.label}>Consulting</div>
        <h2 className={styles.title}>
          How we <em>build the business</em>
        </h2>
        <p className={styles.deck}>
          Three pillars: sharpen the brand, show up with intention, and keep outreach steady — without a laundry list of
          tactics.
        </p>
        <div className={styles.cards}>
          {services.map((service) => (
            <motion.article
              key={service.title}
              className={styles.card}
              whileHover={reduce ? undefined : { y: -4 }}
              transition={{ duration: brandMotion.durationMs / 1000, ease: brandMotion.ease }}
            >
              <div className={styles.icon}>{service.icon}</div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </motion.article>
          ))}
        </div>
        <a href="/services" className={styles.more}>
          See packages and how we work →
        </a>
      </div>
    </section>
  )
}
