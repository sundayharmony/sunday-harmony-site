import Link from 'next/link'
import AuditCtaButton from '@/components/ui/AuditCtaButton'
import PackageRail from './PackageRail'
import WorkPhoto from './WorkPhoto'
import styles from './home.module.css'

const fitPoints = [
  'The brand still looks like a few different businesses.',
  'You are ready to launch, or the site no longer matches the work.',
  'You want a monthly rhythm without hiring a marketing department.',
]

const steps = [
  {
    num: '1',
    title: 'Free audit',
    body: 'We look at the Google profile, the site, and what you are trying to sell. Plain English. No fee.',
  },
  {
    num: '2',
    title: 'You pick the stage',
    body: 'One-time brand or launch, or Marketing Partner by the month. The monthly plan cancels anytime.',
  },
  {
    num: '3',
    title: 'We build the rhythm',
    body: 'Files, the site, and a check-in you can actually read. Printing, hosting, ad spend, and video are quoted apart.',
  },
]

const questions = [
  {
    q: 'Are these long contracts?',
    a: 'No. Business Essentials and Business Launch are one-time. Marketing Partner is monthly and can be cancelled anytime.',
  },
  {
    q: 'Do I have to choose a package before we talk?',
    a: 'No. The cards are a guide. The free audit shows the starting point, and a consultation matches the work to the stage you are in.',
  },
  {
    q: 'What is not included?',
    a: 'Printing, hosting, ad spend, and video are not included unless we quote them. We can coordinate them. They are billed separately.',
  },
  {
    q: 'Is funding or credit part of these packages?',
    a: 'No. Brand, launch, and monthly marketing are this page. Business funding and personal credit are separate doors.',
  },
]

export default function HomeLower() {
  return (
    <>
      <section className={styles.section} id="fit">
        <div className={`${styles.inner} ${styles.fit}`}>
          <div>
            <div className={styles.label}>Who it is for</div>
            <h2 className={styles.title}>
              For the owner who is still <em>the marketing department.</em>
            </h2>
            <p className={styles.deck}>
              You need one look, a site that can take a lead, and someone to keep the month moving. You do not need a
              large agency.
            </p>
            <ul className={styles.fitList}>
              {fitPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
          <WorkPhoto id="fit-table" />
        </div>
      </section>

      <PackageRail />

      <section className={`${styles.section} ${styles.soft}`} id="work">
        <div className={styles.inner}>
          <div className={styles.label}>The work</div>
          <h2 className={styles.title}>
            Warm, clear, and <em>recognizable.</em>
          </h2>
          <p className={styles.deck}>
            The practice is brand, launch, and the monthly rhythm after. These frames are the kind of work we put on
            the table: paper, color, and a place that feels easy to walk into.
          </p>
          <div className={styles.photoGrid}>
            <WorkPhoto id="work-cards" />
            <WorkPhoto id="work-window" />
            <WorkPhoto id="work-board" />
          </div>
        </div>
      </section>

      <section className={styles.section} id="steps">
        <div className={styles.inner}>
          <div className={styles.label}>How it goes</div>
          <h2 className={styles.title}>
            Audit, then a package, <em>then a rhythm.</em>
          </h2>
          <ol className={styles.steps}>
            {steps.map((step) => (
              <li key={step.num} className={styles.step}>
                <span className={styles.num}>{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${styles.section} ${styles.soft}`} id="questions">
        <div className={styles.inner}>
          <div className={styles.label}>Before you start</div>
          <h2 className={styles.title}>
            The questions that <em>usually decide it.</em>
          </h2>
          <div className={styles.faqs}>
            {questions.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} id="audit">
        <div className={styles.inner}>
          <div className={styles.label}>Free audit</div>
          <h2 className={styles.title}>
            See the starting point <em>before you buy.</em>
          </h2>
          <p className={styles.deck}>
            It is a written look at your presence and what to fix first. Use it with us, or on your own. Marketing
            Partner still cancels anytime if you stay on monthly.
          </p>
          <div className={styles.actions}>
            <AuditCtaButton variant="primary" />
            <Link href="/book" className={styles.ghost}>
              Book a consultation
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
