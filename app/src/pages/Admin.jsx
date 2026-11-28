import {useEffect,useState} from 'react'
import {ShieldCheck,Plus,Pencil,Trash2} from 'lucide-react'
import AdminAccounts from '../components/AdminAccounts'
import {Link} from '../components/NavLinks'
import {useAdmin} from '../lib/useAdmin'
import {useFx} from '../lib/fx'
import {usePost} from '../lib/post'
import {adminList,adminSave,adminDelete} from '../data/admin'
import {fetchCanteenPhotos} from '../data/queries'
import {queryKey} from '../data/queryCache'
import {useQuery} from '../data/useQuery'
import Loader from '../components/Loader'
import {photoUrl} from '../lib/photos'
import {DEFAULT_CANTEEN_HOURS} from '../lib/food'
import '../styles/admin-canteen.css'

const RESOURCES={
  accounts:{label:'Accounts'},
  canteens:{label:'Canteens',fields:[['name','Name'],['location','Location'],['lat','Latitude','number'],['lng','Longitude','number'],['known_for','Known for'],['colour','Colour']],create:true},
  foods:{label:'Foods',fields:[['canteen_id','Canteen ID'],['name','Name'],['price','Price (Rs)','number']],create:true},
  posts:{label:'Posts',fields:[['caption','Caption'],['rating','Rating','rating']]},
  comments:{label:'Comments',fields:[['body','Comment']]},
  profiles:{label:'Profiles',fields:[['full_name','Full name'],['faculty','Faculty'],['batch','Batch']],keep:true},
  canteen_photos:{label:'Gallery photos'},
  votes:{label:'Votes'},
  likes:{label:'Likes'},
  canteen_closure_reports:{label:'Closure reports'}
}
const newRecord = kind => kind === 'canteens'
  ? { opens_minute: DEFAULT_CANTEEN_HOURS.opensAt * 60, closes_minute: DEFAULT_CANTEEN_HOURS.closesAt * 60, colour: '#E8492F' }
  : {}

const editRecord = (kind, record) => kind === 'canteens'
  ? { ...record, opens_minute: record.opens_minute ?? record.opens_at * 60, closes_minute: record.closes_minute ?? record.closes_at * 60 }
  : record

function inputTime(minutes) {
  if (minutes == null) return ''
  const hour = Math.floor(minutes / 60) % 24
  return `${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function scheduleMinute(value, closing) {
  if (!value) return null
  const [hour, minute] = value.split(':').map(Number)
  const total = hour * 60 + minute
  return closing && total === 0 ? 1440 : total
}

const PHOTOS_PER_PAGE = 12

function PrimaryPhotoPicker({ canteenId, selected, onSelect, disabled }) {
  const [page, setPage] = useState(0)
  const { data, loading, error, reload } = useQuery(queryKey('admin-canteen-photos', canteenId, page),
    () => fetchCanteenPhotos(canteenId, PHOTOS_PER_PAGE + 1, page * PHOTOS_PER_PAGE))

  return (
    <fieldset className="admin-photo-picker" disabled={disabled}>
      <legend>Primary photo</legend>
      <button type="button" className={'chip' + (!selected ? ' on' : '')} aria-pressed={!selected} onClick={() => onSelect(null)}>Use newest photo</button>
      {loading && <p role="status">Loading gallery photos…</p>}
      {error && <p role="alert">Couldn't load gallery photos. <button className="mini" type="button" onClick={reload}>Retry</button></p>}
      {data?.length === 0 && <p>No gallery photos yet.</p>}
      {data?.length > 0 && (
        <div className="admin-photo-grid">
          {data.slice(0, PHOTOS_PER_PAGE).map((photo, index) => (
            <button key={photo.id} type="button" aria-pressed={selected === photo.id}
              aria-label={`Select gallery photo ${page * PHOTOS_PER_PAGE + index + 1} by ${photo.by}`} onClick={() => onSelect(photo.id)}>
              <img src={photo.url} alt="" loading="lazy" />
              <span>{selected === photo.id ? 'Primary photo' : photo.by}</span>
            </button>
          ))}
        </div>
      )}
      {(page > 0 || data?.length > PHOTOS_PER_PAGE) && (
        <div className="cacts">
          <button type="button" className="mini" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Previous photos</button>
          <button type="button" className="mini" disabled={loading || !data || data.length <= PHOTOS_PER_PAGE} onClick={() => setPage(p => p + 1)}>Next photos</button>
        </div>
      )}
    </fieldset>
  )
}

const recordKey=r=>r.id||[r.user_id,r.post_id,r.canteen_id,r.week_start].filter(Boolean).join('/')
const title=r=>r.name||r.full_name||r.caption||r.body||r.canteen_id||r.post_id||r.id
const summary=r=>[r.location,r.rating,r.price!=null?'Rs '+r.price:'',r.week_start,r.created_at?.slice(0,10),r.reported_at?.slice(0,16)].filter(Boolean).join(' · ')
export default function Admin(){
  const admin=useAdmin()
  const {toast}=useFx()
  const {invalidate}=usePost()
  const [kind,setKind]=useState('canteens')
  const [offset,setOffset]=useState(0)
  const [tick,setTick]=useState(0)
  const [rows,setRows]=useState(null)
  const [error,setError]=useState('')
  const [draft,setDraft]=useState(null)
  const [busy,setBusy]=useState(false)
  const config=RESOURCES[kind]
  useEffect(()=>{
    let live=true
    if(!admin.allowed || kind === 'accounts')return
    setRows(null);setError('')
    adminList(kind,offset).then(data=>{if(live)setRows(data)}).catch(e=>{if(live)setError(e.message)})
    return()=>{live=false}
  },[admin.allowed,kind,offset,tick])
  const change=()=>{setTick(t=>t+1);invalidate()}
  const save=async e=>{
    e.preventDefault()
    if(busy)return
    if (kind === 'canteens' && draft.closes_minute <= draft.opens_minute) {
      toast('Closing time must be after opening time')
      return
    }
    setBusy(true)
    try{await adminSave(kind,draft);setDraft(null);change();toast('Record saved')}
    catch(e){toast(e.message)}finally{setBusy(false)}
  }
  const remove=async row=>{
    if(busy||!window.confirm('Delete this record? Deleting a canteen or food also deletes dependent posts, ratings and votes. This cannot be undone.'))return
    setBusy(true)
    try{const ok=await adminDelete(kind,row);setDraft(null);change();toast(ok?'Record deleted':'Record deleted; photo cleanup needs attention')}
    catch(e){toast(e.message)}finally{setBusy(false)}
  }
  if(admin.loading)return <section className="view"><Loader label="Checking admin access"/></section>
  if(!admin.allowed)return <section className="view"><div className="band"><div className="wrap narrow"><div className="card empty"><h3>Admin access required</h3><p>This area is restricted to approved administrators.</p><Link className="btn sm" to="/profile">Back to profile</Link></div></div></div></section>
  return <section className="view"><div className="band"><div className="wrap narrow">
    <Link className="back" to="/profile">Back to profile</Link>
    <div className="vh"><div><h2><ShieldCheck size={26}/> Admin console</h2><p>Manage accounts and campus food content.</p></div></div>
    <label className="fl card admin-filter"><span>Resource</span><select disabled={busy} value={kind} onChange={e=>{setKind(e.target.value);setOffset(0);setDraft(null)}}>{Object.entries(RESOURCES).map(([key,v])=><option key={key} value={key}>{v.label}</option>)}</select></label>
    {kind === 'accounts' ? <AdminAccounts /> : <>
    {config.create && <button className="btn sm" onClick={()=>setDraft(newRecord(kind))} disabled={busy}><Plus size={18}/>Add record</button>}
    {draft && <form className="card admin-editor" onSubmit={save}><h3>{draft.id?'Edit record':'New record'}</h3>
      {config.fields.map(([key,label,type])=><label className="fl" key={key}><span>{label}</span>{type==='rating'?<select value={draft[key]||'super'} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}>{['super','okay','avoid'].map(v=><option key={v}>{v}</option>)}</select>:<input type={type||'text'} step={type==='number'?'any':undefined} disabled={busy||(kind==='foods'&&key==='canteen_id'&&!!draft.id)} value={draft[key]??''} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/>}</label>)}
      {kind === 'canteens' && <>
        <fieldset className="admin-schedule" disabled={busy}>
          <legend>Daily hours (Colombo time)</legend>
          <div className="admin-schedule-inputs">
            <label className="fl"><span>Opening time</span><input type="time" required value={inputTime(draft.opens_minute)}
              onChange={e => setDraft({ ...draft, opens_minute: scheduleMinute(e.currentTarget.value, false) })} /></label>
            <label className="fl"><span>Closing time</span><input type="time" required value={inputTime(draft.closes_minute)}
              onChange={e => setDraft({ ...draft, closes_minute: scheduleMinute(e.currentTarget.value, true) })} /></label>
          </div>
          <small>Choose 12:00 AM to close at midnight.</small>
        </fieldset>
        {draft.id && <PrimaryPhotoPicker key={draft.id} canteenId={draft.id} selected={draft.primary_photo_id} disabled={busy}
          onSelect={id => setDraft(d => ({ ...d, primary_photo_id: id }))} />}
      </>}
      <div className="cacts"><button type="button" className="btn ghost sm" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button><button className="btn sm" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
    </form>}
    {error && <div className="card empty"><p role="alert">{error}</p><button className="btn sm" onClick={()=>setTick(t=>t+1)}>Retry</button></div>}
    {!rows&&!error&&<Loader label="Loading records"/>}
    {rows?.length===0&&<p>No records on this page.</p>}
    <div className="admin-records">{rows?.map(r=><article className="card admin-record" key={recordKey(r)}>
      {r.photo_path&&<img src={photoUrl(r.photo_path)} alt="" loading="lazy"/>}
      <div><b>{title(r)||'Record'}</b><small>{summary(r)}</small><small className="admin-id">{recordKey(r)}</small></div>
      <div className="admin-actions">{config.fields&&<button className="social-icon" disabled={busy} aria-label="Edit record" onClick={()=>setDraft(editRecord(kind, r))}><Pencil size={18}/></button>}{!config.keep&&<button className="social-icon danger" disabled={busy} aria-label="Delete record" onClick={()=>remove(r)}><Trash2 size={18}/></button>}</div>
    </article>)}</div>
    <div className="cacts"><button className="btn ghost sm" disabled={busy||offset===0} onClick={()=>setOffset(o=>Math.max(0,o-50))}>Previous</button><span>Page {offset/50+1}</span><button className="btn ghost sm" disabled={busy||rows?.length!==50} onClick={()=>setOffset(o=>o+50)}>Next</button></div>
    </>}
    <p className="wl-note">Administrator assignments are managed in Supabase by a trusted operator.</p>
  </div></div></section>
}
