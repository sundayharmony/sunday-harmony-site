import { siteConfig } from '@/lib/data'
import AuditCtaButton from '@/components/ui/AuditCtaButton'
import styles from '@/components/home/home.module.css'

const beats = [
  { title: 'Identity', line: 'Logo, colors, and cards.' },
  { title: 'Website', line: 'A page that can take a lead.' },
  { title: 'Print', line: 'Pieces they can hand over.' },
  { title: 'Social', line: 'The same look, posted.' },
]

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
          <ul className={styles.story}>
            {beats.map((beat) => (
              <li key={beat.title}>
                <strong>{beat.title}</strong>
                <span>{beat.line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
