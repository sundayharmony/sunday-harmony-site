import Link from 'next/link'
import { packageDisclaimer, packagePriceDisplay, packages, type Package } from '@/lib/data'
import PhotoRail from './PhotoRail'
import styles from './home.module.css'

function priceNote(pkg: Package): string {
  if (pkg.priceSuffix === 'monthly') return 'per month'
  if (pkg.priceSuffix === 'one-time') return 'one-time'
  return 'quoted'
}

function priceHref(pkg: Package): string {
  return pkg.priceSuffix === 'quote' ? '/book' : '/services#packages'
}

export default function HomeLower() {
  return (
    <>
      <PhotoRail />
      <section className={styles.section} id="prices">
        <div className={styles.inner}>
          <h2 className="sr-only">Prices</h2>
          <ul className={styles.prices}>
            {packages.map((pkg) => (
              <li key={pkg.tier} className={pkg.popular ? styles.pricePopular : undefined}>
                <Link href={priceHref(pkg)}>
                  <span>{pkg.tier}</span>
                  <strong>{packagePriceDisplay(pkg)}</strong>
                  {pkg.priceSuffix === 'quote' ? null : <small>{priceNote(pkg)}</small>}
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.note}>{packageDisclaimer}</p>
        </div>
      </section>
    </>
  )
}
