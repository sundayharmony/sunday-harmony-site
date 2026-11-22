import Image from 'next/image'
import { workPhoto, type WorkPhotoId } from '@/lib/work-photos'
import styles from './home.module.css'

export default function WorkPhoto({ id }: { id: WorkPhotoId }) {
  const photo = workPhoto(id)

  return (
    <figure className={styles.photo} data-photo-id={photo.id}>
      <Image
        className={styles.photoImg}
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        sizes="(min-width: 768px) 720px, 100vw"
      />
      <figcaption>{photo.label}</figcaption>
    </figure>
  )
}
