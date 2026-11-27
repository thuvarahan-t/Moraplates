import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { centreOf, useFx } from '../lib/fx'
import { uploadPhoto } from '../lib/photos'
import { SAMPLE_CANTEENS, SAMPLE_FOODS } from '../data/sample'
import { CameraIcon, CloseIcon } from './icons'
import Dropdown from './Dropdown'
import CropPhoto from './CropPhoto'

const NEW = '__new'
const RATINGS = [['super', 's', 'Super', 'Would eat again'], ['okay', 'o', 'Okay', "It's fine"], ['avoid', 'a', 'Avoid', 'Skip it']]

async function loadMenu() {
  if (!supabase) return { canteens: SAMPLE_CANTEENS, foods: SAMPLE_FOODS }
  const [c, f] = await Promise.all([
    supabase.from('canteens').select('id, name, location, colour').order('name'),
    supabase.from('foods').select('id, canteen_id, name, price').order('name'),
  ])
  if (c.error || f.error) throw c.error || f.error
  return { canteens: c.data.map(x => ({ id: x.id, name: x.name, location: x.location, colour: x.colour })), foods: f.data.map(x => ({ id: x.id, canteenId: x.canteen_id, name: x.name, price: x.price })) }
}

/** Turns Supabase errors into something a student can act on. */
function friendly(e) {
  if (e?.code === '42501' || /row-level security/i.test(e?.message ?? '')) return 'Only @uom.lk accounts can post.'
  if (e?.code === '23505') return 'That food is already on the menu. Pick it from the list.'
  return e?.message || 'Something went wrong. Try again.'
}

export default function PostDialog({ request, onClose, onPosted }) {
  const dlg = useRef(null)
  const submitBtn = useRef(null)
  const navigate = useNavigate()
  const { session } = useAuth()
  const { toast, confetti } = useFx()

  const [menu, setMenu] = useState(null)
  const [canteenId, setCanteenId] = useState(request.canteenId)
  const [foodId, setFoodId] = useState(request.foodId)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [rating, setRating] = useState('super')
  const [caption, setCaption] = useState('')
  const [photo, setPhoto] = useState(null)
  const [cropFile, setCropFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // Signed out: send them to sign in instead of letting them fill in a form they can't submit.
  const needsSignIn = supabase && !session
  useEffect(() => {
    if (!needsSignIn) return
    onClose()
    navigate('/welcome')
    toast('Sign in with your @uom.lk email to post')
  }, [needsSignIn, onClose, navigate, toast])

  useEffect(() => {
    if (needsSignIn) return
    dlg.current?.showModal()
    loadMenu().then(setMenu).catch(e => { console.error(e); setErr("Couldn't load the menu. Check your connection.") })
  }, [needsSignIn])

  // Default to the first canteen, and to its first food (or "add new" when it has none).
  const cid = canteenId ?? menu?.canteens[0]?.id
  const foods = menu?.foods.filter(f => f.canteenId === cid) ?? []
  const fid = foodId && (foodId === NEW || foods.some(f => f.id === foodId)) ? foodId : foods[0]?.id ?? NEW

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  if (needsSignIn) return null

  const pickPhoto = e => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    setCropFile(f)
    setErr('')
  }

  const submit = async e => {
    e.preventDefault()
    if (busy || cropFile) return
    if (!cid) return setErr('Choose a canteen.')
    if (!photo) return setErr('Add a photo of your plate.')
    const price = Math.round(+newPrice)
    if (fid === NEW) {
      if (!newName.trim()) return setErr('Enter the food name.')
      if (!(price > 0 && price <= 5000)) return setErr('Enter a price between Rs 1 and Rs 5000.')
    }
    if (!supabase) return setErr('Posting needs a Supabase project. Add keys to .env.')

    setBusy(true)
    setErr('')
    let uploadedPath = null
    try {
      let foodRow = fid
      if (fid === NEW) {
        const { data, error } = await supabase.from('foods').insert({ canteen_id: cid, name: newName.trim(), price }).select('id').single()
        if (error) throw error
        foodRow = data.id
      }
      uploadedPath = await uploadPhoto(session.user.id, photo)
      const { error } = await supabase.from('posts').insert({ canteen_id: cid, food_id: foodRow, rating, caption: caption.trim(), photo_path: uploadedPath })
      if (error) throw error
      uploadedPath = null

      const [x, y] = centreOf(submitBtn.current)
      confetti(x, y, 26)
      onPosted()
      onClose()
      navigate('/')
      toast('Plate posted to the feed')
    } catch (e2) {
      if (uploadedPath) await supabase.storage.from('photos').remove([uploadedPath])
      console.error(e2)
      setErr(friendly(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog id="dlg" ref={dlg} aria-labelledby="dlgT" onClose={onClose} onCancel={e=>{if(busy)e.preventDefault()}} onClick={e => !busy && e.target === dlg.current && dlg.current.close()}>
      <form id="pf" noValidate onSubmit={submit}>
        <div className="dh">
          <h2 id="dlgT">Post your plate</h2>
          <button type="button" className="x" aria-label="Close" disabled={busy} onClick={() => dlg.current.close()}>
            <CloseIcon />
          </button>
        </div>

        {cropFile ? <CropPhoto file={cropFile} onCancel={()=>setCropFile(null)} onDone={f=>{setPhoto(f);setPreview(URL.createObjectURL(f));setCropFile(null)}}/> : <label className="pick">
          {preview ? <><img src={preview} alt="Your plate" /><span className="chg">Change photo</span></> : <><CameraIcon /><span>Add a photo of your plate</span></>}
          <input type="file" accept="image/*" onChange={pickPhoto} disabled={busy} aria-label="Photo of your plate" />
        </label>}

        <div className="fl">
          <span id="pf-canteen">Where did you eat?</span>
          <Dropdown
            labelId="pf-canteen" value={cid} disabled={!menu}
            placeholder={err ? 'Canteens unavailable' : 'Loading canteens…'}
            options={(menu?.canteens ?? []).map(c => ({ value: c.id, label: c.name, sub: c.location, dot: c.colour }))}
            onChange={v => { setCanteenId(v); setFoodId(null); setErr('') }}
          />
        </div>

        <div className="fl">
          <span id="pf-food">What did you eat?</span>
          <Dropdown
            labelId="pf-food" value={fid} disabled={!menu}
            options={[
              ...foods.map(f => ({ value: f.id, label: f.name, sub: 'Rs ' + f.price })),
              { value: NEW, label: '+ Add a new food', sub: foods.length ? 'Not on the list? Add it' : 'No foods here yet. Add the first one' },
            ]}
            onChange={v => { setFoodId(v); setErr('') }}
          />
        </div>
        {fid === NEW && (
          <div className="newf">
            <label className="fl"><span>Food name</span><input maxLength={40} placeholder="Cheese kottu" value={newName} onChange={e => { setNewName(e.target.value); setErr('') }} /></label>
            <label className="fl"><span>Price (Rs)</span><input type="number" min="1" max="5000" inputMode="numeric" placeholder="450" value={newPrice} onChange={e => { setNewPrice(e.target.value); setErr('') }} /></label>
          </div>
        )}

        <fieldset>
          <legend>How was it?</legend>
          <div className="seg rate">
            {RATINGS.map(([v, cls, label, sub]) => (
              <label key={v} className={cls}>
                <input type="radio" name="pr" value={v} checked={rating === v} onChange={() => setRating(v)} />
                <span>{label}<small>{sub}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="fl">
          <span>Say something <em>{caption.length}/160</em></span>
          <textarea maxLength={160} rows={3} placeholder="Spicy? Cold? Worth the queue?" value={caption} onChange={e => setCaption(e.target.value)} />
        </label>

        <p className="err" role="alert">{err}</p>
        <button className="btn wide" type="submit" ref={submitBtn} disabled={busy || !menu || !!cropFile}>{busy ? 'Posting…' : 'Post to feed'}</button>
      </form>
    </dialog>
  )
}
