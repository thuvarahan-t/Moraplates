import { supabase } from './supabase'

/** Public URL for a path in the photos bucket. */
export const photoUrl = path => (path && supabase ? supabase.storage.from('photos').getPublicUrl(path).data.publicUrl : null)

/** Shrinks a phone photo to at most `max` px on its long side, as JPEG, so uploads stay well under 5 MB. */
export async function compressImage(file, max = 1600, quality = 0.85) {
  let bmp
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error("That photo can't be read. Try a JPG or PNG.")
  }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  return new Promise((resolve, reject) =>
    c.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't process the photo."))), 'image/jpeg', quality))
}

/** Uploads into the student's own folder (required by the storage policy). Returns the path. */
export async function uploadPhoto(userId, blob) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) throw error
  return path
}
