import { heroStats, heroSubtext, siteConfig } from '@/lib/data'
import AuditCtaButton from '@/components/ui/AuditCtaButton'
import HeroHarmonyVisual from '@/components/HeroHarmonyVisual'
import styles from '@/components/home/home.module.css'

const ticker = [
  siteConfig.tagline,
  'Build the business',
  'Fund the business',
  'Strengthen personal credit',
  'Free audit',
]

export default function Hero() {
  return (
    <>
      <section className={styles.hero} id="hero">
        <div className={styles.grid} />
        <div className={styles.glow} />
        <div className={styles.heroInner}>
          <div className={styles.heroLayout}>
            <div>
              <div className={styles.kicker}>
                <span className={styles.dot} />
                {siteConfig.tagline}
              </div>
              <h1 className={styles.display}>
                Stop guessing.
                <em>Start growing with a clear strategy.</em>
              </h1>
              <p className={styles.lede}>{heroSubtext}</p>
              <div className={styles.actions}>
                <AuditCtaButton variant="primary" />
                <a href="/services#packages" className={styles.ghost}>
                  See Packages
                </a>
              </div>
              <p className={styles.fine}>
                One-time projects or monthly support. Marketing Partner cancels anytime. Transparent reporting.
              </p>
              <div className={styles.stats}>
                {heroStats.map((stat) => (
                  <div key={stat.label}>
                    <div className={styles.statValue}>{stat.value}</div>
                    <div className={styles.statLabel}>{stat.label}</div>
                  </div>
                ))}
              </div>
              <p className={styles.cue}>
                <span className={styles.cueLine} />
                Scroll
              </p>
            </div>
            <div className={styles.visual}>
              <HeroHarmonyVisual />
              <span className="sr-only">
                Decorative illustration: a small storefront growing into a city skyline along a rising path, with icons
                for revenue, savings, ideas, and systems.
              </span>
            </div>
          </div>
        </div>
      </section>
      <div className={styles.marquee} aria-hidden="true">
        <div className={styles.track}>
          {[0, 1].map((copy) => (
            <div className={styles.group} key={copy}>
              {ticker.map((item) => (
                <span key={`${copy}-${item}`}>{item}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
