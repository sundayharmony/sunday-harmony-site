import Image from 'next/image'
import { siteConfig } from '@/lib/data'
import AuditCtaButton from '@/components/ui/AuditCtaButton'
import { storyShot } from '@/lib/work-photos'
import styles from '@/components/home/home.module.css'

const hand = storyShot('hand')

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
            <div className={styles.actions}>
              <AuditCtaButton variant="primary" />
              <a href="#prices" className={styles.ghost}>
                See prices
              </a>
            </div>
          </div>
          <div className={styles.visual}>
            <Image
              className={styles.heroPhoto}
              src={hand.src}
              alt={hand.alt}
              width={hand.width}
              height={hand.height}
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
