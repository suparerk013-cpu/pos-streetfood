const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BASE64_LENGTH = 700 * 1024
const MAX_COMPRESSION_ATTEMPTS = 3

export class InvalidImageError extends Error {}
export class ImageTooLargeError extends Error {}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new InvalidImageError('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้'))
    }
    img.src = url
  })
}

function encodeCanvas(canvas, quality) {
  const webpUrl = canvas.toDataURL('image/webp', quality)
  if (webpUrl.startsWith('data:image/webp')) return webpUrl
  return canvas.toDataURL('image/jpeg', quality)
}

export async function compressImageToBase64(file, maxWidth = 300, quality = 0.7) {
  if (!file || !ACCEPTED_TYPES.includes(file.type)) {
    throw new InvalidImageError('ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ (jpeg, png, webp เท่านั้น)')
  }

  const image = await loadImage(file)
  const scale = Math.min(1, maxWidth / image.width)
  const targetWidth = Math.round(image.width * scale)
  const targetHeight = Math.round(image.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

  let currentQuality = quality
  for (let attempt = 0; attempt < MAX_COMPRESSION_ATTEMPTS; attempt++) {
    const dataUrl = encodeCanvas(canvas, currentQuality)
    if (dataUrl.length <= MAX_BASE64_LENGTH) {
      return dataUrl
    }
    currentQuality = Math.max(0.1, currentQuality - 0.2)
  }

  throw new ImageTooLargeError('รูปภาพใหญ่เกินไป แม้ลดคุณภาพแล้ว กรุณาเลือกรูปอื่น')
}
