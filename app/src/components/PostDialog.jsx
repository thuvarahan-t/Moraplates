import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { centreOf, useFx } from '../lib/fx'
import { uploadPhoto } from '../lib/photos'
import { SAMPLE_CANTEENS, SAMPLE_FOODS } from '../data/sample'
import { CameraIcon, CloseIcon } from './icons'
import Dropdown from './Dropdown'
import CropPhoto, { EditPhotoButton } from './CropPhoto'
import { usePhotoPick } from '../lib/usePhotoPick'
import StarRating, { starsToRating } from './StarRating'

const NEW = '__new'

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
  const nameInput = useRef(null)
  const navigate = useNavigate()
  const { session } = useAuth()
  const { toast, confetti } = useFx()

  const [menu, setMenu] = useState(null)
  const [canteenId, setCanteenId] = useState(request.canteenId)
  const [foodId, setFoodId] = useState(request.foodId)
  const [openFood, setOpenFood] = useState(0)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [stars, setStars] = useState(0)
  const [caption, setCaption] = useState('')
  const pic = usePhotoPick()
  const { photo, preview } = pic
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

  // Only foods from the chosen canteen. Nothing is pre-picked unless the dialog was opened from a canteen or dish.
  const cid = menu?.canteens.some(c => c.id === canteenId) ? canteenId : null
  const foods = menu?.foods.filter(f => f.canteenId === cid) ?? []
  const fid = foodId === NEW || foods.some(f => f.id === foodId) ? foodId : null

  useEffect(() => { if (fid === NEW) nameInput.current?.focus({ preventScroll: false }) }, [fid])

  if (needsSignIn) return null

  const pickPhoto = e => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setErr('')
    pic.pick(f)
  }

  const submit = async e => {
    e.preventDefault()
    if (busy || pic.editing || pic.processing) return
    if (!photo) return setErr('Add a photo of your plate.')
    if (!cid) return setErr('Choose the canteen.')
    if (!fid) return setErr('Choose what you ate, or add it.')
    const price = Math.round(+newPrice)
    if (fid === NEW) {
      if (!newName.trim()) return setErr('Enter the food name.')
      if (!(price > 0 && price <= 5000)) return setErr('Enter a price between Rs 1 and Rs 5000.')
    }
    if (!stars) return setErr('Give it 1 to 5 stars.')
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
      const { error } = await supabase.from('posts').insert({ canteen_id: cid, food_id: foodRow, rating: starsToRating(stars), caption: caption.trim(), photo_path: uploadedPath })
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

  const canteen = menu?.canteens.find(c => c.id === cid)

  return (
    <dialog id="dlg" className="pd" ref={dlg} aria-labelledby="dlgT" onClose={onClose} onCancel={e=>{if(busy)e.preventDefault()}} onClick={e => !busy && e.target === dlg.current && dlg.current.close()}>
      <form id="pf" noValidate onSubmit={submit}>
        <div className="dh">
          <h2 id="dlgT">Post your plate</h2>
          <button type="button" className="x" aria-label="Close" disabled={busy} onClick={() => dlg.current.close()}>
            <CloseIcon />
          </button>
        </div>

        <div className="pf-body">
          {pic.editing ? <CropPhoto file={pic.original} initial={pic.edit} onCancel={pic.closeEditor} onDone={pic.finishEdit} /> : (
            <div className="pf-top">
              <div className="pf-photo-wrap">
                <label className={'pick pf-photo' + (preview ? ' has' : '') + (pic.processing ? ' busy' : '')}>
                  {preview ? <><img src={preview} alt="Your plate" /><span className="chg">Change</span></>
                    : <><CameraIcon /><span>{pic.processing ? 'Adding…' : 'Add photo'}</span></>}
                  <input type="file" accept="image/*" onChange={pickPhoto} disabled={busy || pic.processing} aria-label="Photo of your plate" />
                </label>
                {preview && <EditPhotoButton onClick={pic.openEditor} disabled={busy || pic.processing} />}
              </div>
              <div className="pf-where">
                <div className="fl">
                  <span id="pf-canteen">Canteen</span>
                  <Dropdown
                    labelId="pf-canteen" value={cid} disabled={!menu || busy} searchable
                    placeholder={!menu ? (err ? 'Unavailable' : 'Loading…') : 'Where did you eat?'}
                    searchPlaceholder="Search canteens" emptyText="No canteen by that name"
                    options={(menu?.canteens ?? []).map(c => ({ value: c.id, label: c.name, sub: c.location, dot: c.colour }))}
                    onChange={v => { setCanteenId(v); setFoodId(null); setErr(''); setOpenFood(n => n + 1) }}
                  />
                </div>
                <div className="fl">
                  <span id="pf-food">Food</span>
                  <Dropdown
                    labelId="pf-food" value={fid} disabled={!cid || busy} searchable openSignal={openFood}
                    placeholder={cid ? 'What did you eat?' : 'Pick a canteen first'}
                    searchPlaceholder={`Search ${canteen?.name ?? ''} menu`} emptyText="Not on this menu yet"
                    options={[
                      ...foods.map(f => ({ value: f.id, label: f.name, sub: 'Rs ' + f.price })),
                      ...(fid === NEW ? [{ value: NEW, label: newName.trim() || 'New food', sub: 'Adding to the menu' }] : []),
                    ]}
                    action={{
                      label: q => (q ? `+ Add “${q}”` : '+ Add a new food'),
                      sub: foods.length ? 'Not on the list? Add it to the menu' : 'No foods here yet. Add the first one',
                      onPick: q => { setFoodId(NEW); if (q) setNewName(q); setErr('') },
                    }}
                    onChange={v => { setFoodId(v); setErr('') }}
                  />
                </div>
              </div>
            </div>
          )}

          {fid === NEW && !pic.editing && (
            <div className="newf pf-new">
              <label className="fl"><span>New food name</span><input ref={nameInput} maxLength={40} placeholder="Cheese kottu" value={newName} onChange={e => { setNewName(e.target.value); setErr('') }} /></label>
              <label className="fl pf-price"><span>Price (Rs)</span><input type="number" min="1" max="5000" inputMode="numeric" placeholder="450" value={newPrice} onChange={e => { setNewPrice(e.target.value); setErr('') }} /></label>
            </div>
          )}

          <StarRating value={stars} onChange={n => { setStars(n); setErr('') }} disabled={busy} />

          <label className="fl pf-say">
            <span>Say something <em>{caption.length}/160</em></span>
            <textarea maxLength={160} rows={2} placeholder="Spicy? Cold? Worth the queue?" value={caption} onChange={e => setCaption(e.target.value)} />
          </label>
        </div>

        <div className="pf-foot">
          {(err || pic.error) && <p className="err" role="alert">{err || pic.error}</p>}
          <button className="btn wide" type="submit" ref={submitBtn} disabled={busy || !menu || pic.editing || pic.processing}>{busy ? 'Posting…' : 'Post to feed'}</button>
        </div>
      </form>
    </dialog>
  )
}
