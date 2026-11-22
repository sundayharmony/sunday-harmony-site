import Link from 'next/link'
import localFont from 'next/font/local'
import { packagePriceDisplay, packages, siteConfig, type Package } from '@/lib/data'
import styles from './design.module.css'

const fraunces = localFont({
  src: '../../fonts/fraunces-latin-opsz-normal.woff2',
  variable: '--font-fraunces',
  display: 'swap',
  weight: '100 900',
})

const PLAN_LINES: Record<string, string> = {
  'Business Essentials': 'Logo, colors, type, business card.',
  'Business Launch': 'Full identity and a 5-page site.',
  'Marketing Partner': 'Posts, graphics, and site upkeep.',
  'Custom Solutions': 'Print, apparel, ads, and systems.',
}

function planPrice(pkg: Package): string {
  const price = packagePriceDisplay(pkg)
  return pkg.priceSuffix === 'monthly' ? `${price}/mo` : price
}

function Browser({ dark = false }: { dark?: boolean }) {
  return (
    <div className={styles.browser}>
      <div className={styles.browserBar}>
        <i className={styles.dotGold} />
        <i />
        <i />
      </div>
      <div className={styles.browserBody}>
        <div className={styles.browserTitle}>Stop guessing. Start growing.</div>
        <div className={styles.line} style={{ width: '62%' }} />
        <div className={styles.line} style={{ width: '52%' }} />
        <div className={styles.line} style={{ width: '38%' }} />
        <div className={dark ? styles.pillGold : styles.pill} />
      </div>
    </div>
  )
}

function Swatches() {
  return (
    <div className={styles.swatches}>
      <i style={{ background: 'var(--ink)' }} />
      <i style={{ background: 'var(--gold)' }} />
      <i style={{ background: 'var(--cream)', borderColor: 'var(--rule)' }} />
      <i style={{ background: 'var(--sand)' }} />
    </div>
  )
}

export default function HomeDesign() {
  return (
    <div className={`${fraunces.variable} ${styles.page}`}>
      <section className={styles.hero} id="hero">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>{siteConfig.tagline}</p>
          <h1 className={styles.display}>Stop guessing. Start growing with a clear strategy.</h1>
          <p className={styles.lede}>
            Sunday Harmony Consulting designs the brand, implements the strategy, and builds the systems a business
            actually runs on.
          </p>
          <div className={styles.actions}>
            <Link href="/contact" className={styles.btnDark}>Get Your Free Audit →</Link>
            <Link href="/services#packages" className={styles.btnLine}>See Packages</Link>
          </div>
        </div>

        <div className={styles.heroArt} aria-hidden="true">
          <div className={styles.collage}>
            <div className={styles.collageBrowser}><Browser /></div>
            <div className={styles.monogram}>SH</div>
            <div className={styles.note}>Show up with intention.</div>
            <div className={styles.card}>
              <strong>Sunday Harmony</strong>
              <span className={styles.cardRule} />
              <small>{siteConfig.tagline}</small>
            </div>
            <div className={styles.collageSwatches}><Swatches /></div>
          </div>
        </div>
      </section>

      <section className={styles.railSection} aria-labelledby="what-we-make">
        <div className={styles.railHead}>
          <h2 id="what-we-make" className={styles.h2}>One look. Everywhere it shows up.</h2>
        </div>
        <div className={styles.rail} tabIndex={0} aria-label="What we make">
          <article className={`${styles.tile} ${styles.tileSand}`}>
            <div className={styles.tileArt} aria-hidden="true">
              <div className={styles.idMono}>SH</div>
              <div className={styles.idBars}>
                <i style={{ background: 'var(--ink)' }} />
                <i style={{ background: 'var(--gold)' }} />
                <i style={{ background: 'var(--cream)', border: '0.3cqw solid var(--rule)' }} />
                <i style={{ background: 'var(--sand)' }} />
              </div>
              <div className={styles.idType}>
                <span className={styles.serif}>Aa</span>
                <span>Aa</span>
              </div>
            </div>
            <div className={styles.tileText}>
              <h3>Identity</h3>
              <p>Logo, color, and type.</p>
            </div>
          </article>

          <article className={`${styles.tile} ${styles.tileInk}`}>
            <div className={styles.tileArt} aria-hidden="true">
              <div className={styles.webBrowser}><Browser dark /></div>
              <div className={styles.phone}>
                <div className={styles.phoneTitle}>Stop guessing.</div>
                <div className={styles.line} style={{ width: '70%' }} />
                <div className={styles.line} style={{ width: '50%' }} />
                <div className={styles.phoneBlock} />
              </div>
            </div>
            <div className={styles.tileText}>
              <h3>Website</h3>
              <p>A site that feels like you.</p>
            </div>
          </article>

          <article className={`${styles.tile} ${styles.tileWheat}`}>
            <div className={styles.tileArt} aria-hidden="true">
              <div className={styles.letter}>
                <span className={styles.cardRule} />
                <strong>Sunday Harmony</strong>
                {[73, 63, 70, 50, 66].map((w) => (
                  <div key={w} className={styles.lineThin} style={{ width: `${w}%` }} />
                ))}
              </div>
              <div className={styles.bizDark}>
                <strong>Sunday Harmony</strong>
                <span className={styles.cardRule} />
              </div>
              <div className={styles.bizLight}>
                <div className={styles.bizMono}>SH</div>
                <div className={styles.bizLines}>
                  <i /><i /><i />
                </div>
              </div>
            </div>
            <div className={styles.tileText}>
              <h3>Print</h3>
              <p>Cards, letterhead, and signage.</p>
            </div>
          </article>

          <article className={`${styles.tile} ${styles.tilePaper}`}>
            <div className={styles.feed} aria-hidden="true">
              <div className={styles.post} style={{ background: 'var(--ink)', color: 'var(--cream)' }}>
                <span className={styles.serif}>Show up with intention.</span>
              </div>
              <div className={styles.post} style={{ background: 'var(--gold)' }}>Brand &amp; Story</div>
              <div className={`${styles.post} ${styles.postCenter}`} style={{ background: 'var(--cream)', border: '0.3cqw solid var(--rule)' }}>
                <span className={styles.feedMono}>SH</span>
              </div>
              <div className={`${styles.post} ${styles.postCenter}`} style={{ background: 'var(--sand)' }}>
                <span className={styles.feedDot} />
              </div>
              <div className={styles.post} style={{ background: 'var(--wheat)' }}>Outreach &amp; Presence</div>
              <div className={`${styles.post} ${styles.postCenter} ${styles.serif}`} style={{ background: 'var(--gold)', fontSize: '8cqw' }}>SH</div>
            </div>
            <div className={styles.tileText}>
              <h3>Social</h3>
              <p>A feed that matches the brand.</p>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.plansSection} id="prices">
        <h2 className={styles.h2}>Start where you are.</h2>
        <ul className={styles.plans}>
          {packages.map((pkg) => (
            <li key={pkg.tier}>
              <Link href={pkg.priceSuffix === 'quote' ? '/book' : '/services#packages'} className={styles.plan}>
                <span className={styles.planName}>{pkg.tier}</span>
                <strong className={styles.planPrice}>{planPrice(pkg)}</strong>
                <span className={styles.planLine}>{PLAN_LINES[pkg.tier] || pkg.tagline}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/services#packages" className={styles.more}>See what&apos;s included →</Link>
      </section>

      <section className={styles.ctaWrap}>
        <div className={styles.cta}>
          <div>
            <h2 className={styles.h2}>Start with a free audit.</h2>
            <p>We&apos;ll show you what to fix first.</p>
          </div>
          <Link href="/contact" className={styles.btnGold}>Get Your Free Audit →</Link>
        </div>
      </section>
    </div>
  )
}
