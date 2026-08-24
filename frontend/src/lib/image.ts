/**
 * The longest edge Claude looks at. Sending more pixels costs upload time and
 * buys nothing; sending fewer loses the small print in a screenshot, which is
 * exactly the part that has to be read.
 */
const MAX_EDGE = 1568

export interface PreparedImage {
  imageBase64: string
  mediaType: string
}

/**
 * Decodes the picked file, shrinks it only if it is larger than the model
 * looks at, and re-encodes as JPEG — which also normalises whatever the phone
 * handed over (HEIC on iOS) into a format the API accepts.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unavailable')
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!blob) throw new Error('encode failed')

    return { imageBase64: await toBase64(blob), mediaType: 'image/jpeg' }
  } finally {
    bitmap.close()
  }
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.onload = () => {
      const result = String(reader.result)
      // A data URL, so the payload starts after the comma.
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}
