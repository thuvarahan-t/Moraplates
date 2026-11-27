import { supabase } from './supabase'
import { decodePhoto, drawCrop, jpegBlob } from './crop'

/** Public URL for a path in the photos bucket. */
export const photoUrl = path => (path && supabase ? supabase.storage.from('photos').getPublicUrl(path).data.publicUrl : null)

/** Shrinks a phone photo to at most `max` px on its long side, as JPEG, so uploads stay well under 5 MB. */
export async function compressImage(file, max = 1600, quality = 0.85) {
  const img=await decodePhoto(file)
  const c=document.createElement('canvas')
  drawCrop(c,img,{x:0,y:0,width:img.naturalWidth,height:img.naturalHeight},max)
  return jpegBlob(c,quality)
}

/** Uploads into the student's own folder (required by the storage policy). Returns the path. */
export async function uploadPhoto(userId, blob) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) throw error
  return path
}
