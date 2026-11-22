import { processSteps } from '@/lib/data'
import styles from '@/components/home/home.module.css'

export default function Process() {
  return (
    <section className={`${styles.section} ${styles.soft}`} id="process">
      <div className={styles.inner}>
        <div className={styles.label}>How It Works</div>
        <h2 className={styles.title}>
          From first call to <em>first results</em>
        </h2>
        <p className={styles.deck}>We make getting started simple. Here&apos;s what happens when you reach out.</p>
        <ol className={styles.steps}>
          {processSteps.map((step) => (
            <li key={step.num} className={styles.step}>
              <span className={styles.num}>{step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
