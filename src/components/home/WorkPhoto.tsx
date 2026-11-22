import Image from 'next/image'
import { workPhoto, type WorkPhotoId } from '@/lib/work-photos'
import styles from './home.module.css'

export default function WorkPhoto({ id }: { id: WorkPhotoId }) {
  const photo = workPhoto(id)

  return (
    <figure className={styles.photo} data-photo-id={photo.id}>
      {photo.src ? (
        <Image className={styles.photoImg} src={photo.src} alt={photo.alt} width={1600} height={1200} sizes="(min-width: 768px) 360px, 100vw" />
      ) : (
        <div className={styles.photoSlot} role="img" aria-label={photo.alt} />
      )}
      <figcaption>{photo.label}</figcaption>
    </figure>
  )
}
