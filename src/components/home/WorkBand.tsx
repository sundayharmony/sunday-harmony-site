import type { WorkPhotoId } from '@/lib/work-photos'
import WorkPhoto from './WorkPhoto'
import styles from './home.module.css'

/** One warm photograph between existing sections on a marketing page. */
export default function WorkBand({ id }: { id: WorkPhotoId }) {
  return (
    <aside className={styles.band} aria-label="Studio photograph">
      <div className={styles.inner}>
        <WorkPhoto id={id} />
      </div>
    </aside>
  )
}
