'use client'

/** PUT file bytes to a Supabase signed upload URL with optional progress callbacks. */
export function uploadDisputeLetterToSignedUrl(
  signedUrl: string,
  token: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('x-upsert', 'false')
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(file)
  })
}
