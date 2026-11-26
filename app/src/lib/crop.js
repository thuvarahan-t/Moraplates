/** Centered cover crop, with normalized pan (0..1) and zoom >= 1. */
export function cropRect(width,height,aspect,zoom=1,x=.5,y=.5) {
  if (!(width>0 && height>0 && aspect>0)) throw new Error('Invalid photo size')
  const z=Math.max(1,Math.min(3,zoom))
  const w=Math.min(width,height*aspect)/z, h=w/aspect
  const clamp=v=>Math.max(0,Math.min(1,v))
  return { x:(width-w)*clamp(x), y:(height-h)*clamp(y), width:w, height:h }
}
export async function decodePhoto(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Choose a photo file.')
  if (file.size > 30*1024*1024) throw new Error('Choose a photo smaller than 30 MB.')
  const url=URL.createObjectURL(file)
  try {
    const img=new Image()
    img.src=url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Invalid photo')
    return img
  } catch { throw new Error('This image could not be opened. Try JPG, PNG or WebP.') }
  finally { URL.revokeObjectURL(url) }
}
export function drawCrop(canvas,img,rect,max=1600) {
  const scale=Math.min(1,max/Math.max(rect.width,rect.height))
  canvas.width=Math.max(1,Math.round(rect.width*scale))
  canvas.height=Math.max(1,Math.round(rect.height*scale))
  const ctx=canvas.getContext('2d')
  if (!ctx) throw new Error('Photo processing is unavailable.')
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height)
  ctx.drawImage(img,rect.x,rect.y,rect.width,rect.height,0,0,canvas.width,canvas.height)
}
export async function jpegBlob(canvas,quality=.86) {
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality))
  if (!blob) throw new Error("Couldn't process the photo.")
  return blob
}
