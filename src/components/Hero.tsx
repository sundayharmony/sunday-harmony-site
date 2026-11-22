import Image from 'next/image'
import { siteConfig } from '@/lib/data'
import AuditCtaButton from '@/components/ui/AuditCtaButton'
import styles from '@/components/home/home.module.css'

const shots = [
  {
    src: '/work/identity.jpg',
    width: 1600,
    height: 1067,
    title: 'Identity',
    alt: 'Hands sketching logo marks in pen on paper at a warm wood desk.',
    credit: (
      <>
        Photo by <a href="https://customneon.co.uk/">Claireneon</a>,{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>
      </>
    ),
  },
  {
    src: '/work/website.jpg',
    width: 1600,
    height: 1067,
    title: 'Website',
    alt: 'A laptop on a bright table, open to a website, with coffee beside it.',
  },
  {
    src: '/work/print.jpg',
    width: 1000,
    height: 612,
    title: 'Print',
    alt: 'A printed business card for Lake Washington Pharmacy, with a small mark, the shop name, and a Seattle address.',
    contain: true,
  },
]

export default function Hero() {
  const [lead, ...rest] = shots

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
          <figure className={styles.frame}>
            <Image
              className={styles.heroPhoto}
              src={lead.src}
              alt={lead.alt}
              width={lead.width}
              height={lead.height}
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
            />
            <figcaption>
              {lead.title}
              <small>{lead.credit}</small>
            </figcaption>
          </figure>
        </div>
        <ul className={styles.pair}>
          {rest.map((shot) => (
            <li key={shot.title}>
              <figure className={shot.contain ? `${styles.frame} ${styles.frameContain}` : styles.frame}>
                <Image
                  className={styles.heroPhoto}
                  src={shot.src}
                  alt={shot.alt}
                  width={shot.width}
                  height={shot.height}
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
                <figcaption>{shot.title}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
