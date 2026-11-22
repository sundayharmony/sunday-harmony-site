import { heroSubtext, siteConfig } from '@/lib/data'
import AuditCtaButton from '@/components/ui/AuditCtaButton'
import HeroHarmonyVisual from '@/components/HeroHarmonyVisual'
import styles from '@/components/home/home.module.css'

export default function Hero() {
  return (
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
  )
}
