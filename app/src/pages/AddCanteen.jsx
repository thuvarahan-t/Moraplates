import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Link } from '../components/NavLinks'
import MapView, { locate } from '../components/MapView'
import CropPhoto from '../components/CropPhoto'
import { BackIcon, CameraIcon, PinIcon } from '../components/icons'
import { addCanteen, friendly } from '../data/queries'
import { useAuth } from '../lib/auth'
import { centreOf, useFx } from '../lib/fx'
import { hourLabel } from '../lib/food'
import { useSignInGate } from '../lib/useSignInGate'

const HOURS = Array.from({ length: 25 }, (_, h) => h)

/** Students add a canteen: name, where it is (text + map pin), hours, optional photo. */
export default function AddCanteen() {
  const { session, ready } = useAuth()
  const gate = useSignInGate()
  const navigate = useNavigate()
  const { toast, confetti } = useFx()

  const [f, setF] = useState({ name: '', location: '', knownFor: '', opensAt: 7, closesAt: 18 })
  const [spot, setSpot] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [cropFile, setCropFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (ready) gate('to add a canteen') }, [ready, gate])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const set = k => e => { setF(v => ({ ...v, [k]: e.target.type === 'select-one' ? +e.target.value : e.target.value })); setErr('') }

  const useMine = async () => {
    try { setSpot(await locate()); setErr('') } catch (e) { setErr(e.message) }
  }

  const submit = async e => {
    e.preventDefault()
    if(busy || cropFile) return
    if (f.name.trim().length < 2) return setErr('Enter the canteen name.')
    if (f.location.trim().length < 2) return setErr('Say where it is, like "Behind the civil faculty".')
    if (f.closesAt <= f.opensAt) return setErr('Closing time must be after opening time.')
    if (!spot) return setErr('Tap the map to drop a pin where the canteen is.')
    if (!gate('to add a canteen')) return
    setBusy(true)
    try {
      const id = await addCanteen(session.user.id, { ...f, name: f.name.trim(), location: f.location.trim(), knownFor: f.knownFor.trim(), lat: spot.lat, lng: spot.lng, photo })
      const [x, y] = centreOf(e.nativeEvent.submitter ?? e.currentTarget)
      confetti(x, y, 26)
      toast(f.name.trim() + ' added. Now add its foods.')
      navigate(`/canteens/${id}`)
    } catch (e2) {
      setErr(friendly(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="view"><div className="band"><div className="wrap narrow">
      <Link className="back" to="/canteens"><BackIcon />All canteens</Link>
      <div className="vh"><div><h2>Add a canteen</h2><p>Know a place that's missing? Put it on the map.</p></div></div>

      <form className="card formcard rise" noValidate onSubmit={submit}>
        <label className="fl"><span>Canteen name</span><input maxLength={50} placeholder="Wala canteen" value={f.name} onChange={set('name')} /></label>
        <label className="fl"><span>Where is it?</span><input maxLength={80} placeholder="Behind the civil faculty" value={f.location} onChange={set('location')} /></label>
        <div className="afr">
          <label className="fl"><span>Opens</span><select value={f.opensAt} onChange={set('opensAt')}>{HOURS.slice(0, 24).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></label>
          <label className="fl"><span>Closes</span><select value={f.closesAt} onChange={set('closesAt')}>{HOURS.slice(1).map(h => <option key={h} value={h}>{h === 24 ? 'Midnight' : hourLabel(h)}</option>)}</select></label>
        </div>
        <label className="fl"><span>Known for <em>optional</em></span><input maxLength={40} placeholder="Chicken kottu" value={f.knownFor} onChange={set('knownFor')} /></label>

        <div className="fl">
          <span>Pin it on the map</span>
          <MapView value={spot} onPick={p => { setSpot(p); setErr('') }} height={300} />
          <div className="maprow">
            <small>{spot ? 'Pinned. Drag the pin to adjust.' : 'Tap the map where the canteen is.'}</small>
            <button type="button" className="mini" onClick={useMine}><PinIcon /> Use my location</button>
          </div>
        </div>

        {cropFile ? <CropPhoto file={cropFile} fixedAspect={4/3} onCancel={()=>setCropFile(null)} onDone={f=>{setPhoto(f);setPreview(URL.createObjectURL(f));setCropFile(null)}}/> : <label className="pick small">
          {preview ? <><img src={preview} alt="Canteen" /><span className="chg">Change photo</span></> : <><CameraIcon /><span>Add a photo of the canteen <em>(optional)</em></span></>}
          <input type="file" accept="image/*" aria-label="Photo of the canteen"
            onChange={e => { const x = e.target.files?.[0]; e.target.value=''; if (x) setCropFile(x) }} />
        </label>}

        <p className="err" role="alert">{err}</p>
        <button className="btn wide" disabled={busy || !!cropFile}>{busy ? 'Adding…' : 'Add canteen'}</button>
        <p className="wl-note">You can add its foods and prices right after.</p>
      </form>
    </div></div></section>
  )
}
