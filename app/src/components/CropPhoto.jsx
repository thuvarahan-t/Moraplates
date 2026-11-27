import { useEffect, useRef, useState } from 'react'
import { Crop, RotateCcw } from 'lucide-react'
import { cropRect, decodePhoto, drawCrop, jpegBlob } from '../lib/crop'

export default function CropPhoto({ file, onDone, onCancel, fixedAspect, max=1600 }) {
  const [img,setImg]=useState(null)
  const [ratio,setRatio]=useState(fixedAspect || 4/5)
  const [zoom,setZoom]=useState(1)
  const [x,setX]=useState(.5)
  const [y,setY]=useState(.5)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const canvas=useRef(null), drag=useRef(null)
  useEffect(()=>{
    let live=true
    setImg(null); setError('')
    decodePhoto(file).then(i=>{if(live)setImg(i)}).catch(e=>{if(live)setError(e.message)})
    return ()=>{live=false}
  },[file])
  const rect=img ? cropRect(img.naturalWidth,img.naturalHeight,ratio,zoom,x,y) : null
  useEffect(()=>{
    if (!img || !canvas.current) return
    try { drawCrop(canvas.current,img,cropRect(img.naturalWidth,img.naturalHeight,ratio,zoom,x,y),640) }
    catch(e){setError(e.message)}
  },[img,ratio,zoom,x,y])
  const finish=async()=>{
    if(!img || busy) return
    setBusy(true);setError('')
    try {
      const output=document.createElement('canvas')
      drawCrop(output,img,rect,max)
      const blob=await jpegBlob(output)
      onDone(new File([blob],'plate.jpg',{type:'image/jpeg'}))
    } catch(e){setError(e.message);setBusy(false)}
  }
  const reset=()=>{setZoom(1);setX(.5);setY(.5)}
  const start=e=>{
    if(!img)return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current={x:e.clientX,y:e.clientY,px:x,py:y,w:e.currentTarget.clientWidth,h:e.currentTarget.clientHeight}
  }
  const move=e=>{
    const d=drag.current;if(!d||!rect)return
    const clamp=v=>Math.max(0,Math.min(1,v))
    if(img.naturalWidth>rect.width) setX(clamp(d.px-(e.clientX-d.x)*rect.width/d.w/(img.naturalWidth-rect.width)))
    if(img.naturalHeight>rect.height) setY(clamp(d.py-(e.clientY-d.y)*rect.height/d.h/(img.naturalHeight-rect.height)))
  }
  return <section className="crop-editor" aria-label="Crop photo">
    <div className="people-heading"><h3><Crop size={19}/> Crop photo</h3><button type="button" className="mini" onClick={reset}><RotateCcw size={16}/> Reset</button></div>
    {!fixedAspect && <div className="chips scroll">{[[4/5,'Portrait'],[1,'Square'],[4/3,'Landscape']].map(([v,label])=><button key={label} type="button" className={'chip'+(ratio===v?' on':'')} aria-pressed={ratio===v} onClick={()=>{setRatio(v);reset()}}>{label}</button>)}</div>}
    {img ? <canvas ref={canvas} className="crop-preview" aria-label="Crop preview; drag to reposition" onPointerDown={start} onPointerMove={move} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}/> : !error && <p role="status">Preparing photo…</p>}
    <label className="fl"><span>Zoom</span><input type="range" min="1" max="3" step=".02" value={zoom} onChange={e=>setZoom(+e.target.value)} disabled={!img}/></label>
    <div className="crop-sliders">
      <label className="fl"><span>Horizontal position</span><input type="range" min="0" max="1" step=".01" value={x} onChange={e=>setX(+e.target.value)} disabled={!img}/></label>
      <label className="fl"><span>Vertical position</span><input type="range" min="0" max="1" step=".01" value={y} onChange={e=>setY(+e.target.value)} disabled={!img}/></label>
    </div>
    {error && <p className="err" role="alert">{error}</p>}
    <div className="cacts"><button className="btn ghost sm" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="btn sm" type="button" onClick={finish} disabled={!img||busy||!!error}>{busy?'Processing…':'Use crop'}</button></div>
  </section>
}
