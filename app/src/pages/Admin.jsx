import {useEffect,useState} from 'react'
import {ShieldCheck,Plus,Pencil,Trash2} from 'lucide-react'
import {Link} from '../components/NavLinks'
import {useAdmin} from '../lib/useAdmin'
import {useFx} from '../lib/fx'
import {usePost} from '../lib/post'
import {adminList,adminSave,adminDelete} from '../data/admin'
import Loader from '../components/Loader'
import {photoUrl} from '../lib/photos'
import {DEFAULT_CANTEEN_HOURS} from '../lib/food'

const RESOURCES={
  canteens:{label:'Canteens',fields:[['name','Name'],['location','Location'],['lat','Latitude','number'],['lng','Longitude','number'],['opens_at','Opens (hour)','number'],['closes_at','Closes (hour)','number'],['known_for','Known for'],['colour','Colour']],create:true},
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
  ? { opens_at: DEFAULT_CANTEEN_HOURS.opensAt, closes_at: DEFAULT_CANTEEN_HOURS.closesAt, colour: '#E8492F' }
  : {}
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
    if(!admin.allowed)return
    setRows(null);setError('')
    adminList(kind,offset).then(data=>{if(live)setRows(data)}).catch(e=>{if(live)setError(e.message)})
    return()=>{live=false}
  },[admin.allowed,kind,offset,tick])
  const change=()=>{setTick(t=>t+1);invalidate()}
  const save=async e=>{
    e.preventDefault()
    if(busy)return
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
    <div className="vh"><div><h2><ShieldCheck size={26}/> Admin console</h2><p>Manage campus food content. Changes affect all students.</p></div></div>
    <label className="fl card admin-filter"><span>Resource</span><select disabled={busy} value={kind} onChange={e=>{setKind(e.target.value);setOffset(0);setDraft(null)}}>{Object.entries(RESOURCES).map(([key,v])=><option key={key} value={key}>{v.label}</option>)}</select></label>
    {config.create && <button className="btn sm" onClick={()=>setDraft(newRecord(kind))} disabled={busy}><Plus size={18}/>Add record</button>}
    {draft && <form className="card admin-editor" onSubmit={save}><h3>{draft.id?'Edit record':'New record'}</h3>
      {config.fields.map(([key,label,type])=><label className="fl" key={key}><span>{label}</span>{type==='rating'?<select value={draft[key]||'super'} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}>{['super','okay','avoid'].map(v=><option key={v}>{v}</option>)}</select>:<input type={type||'text'} step={type==='number'?'any':undefined} disabled={busy||(kind==='foods'&&key==='canteen_id'&&!!draft.id)} value={draft[key]??''} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/>}</label>)}
      <div className="cacts"><button type="button" className="btn ghost sm" disabled={busy} onClick={()=>setDraft(null)}>Cancel</button><button className="btn sm" disabled={busy}>{busy?'Saving…':'Save'}</button></div>
    </form>}
    {error && <div className="card empty"><p role="alert">{error}</p><button className="btn sm" onClick={()=>setTick(t=>t+1)}>Retry</button></div>}
    {!rows&&!error&&<Loader label="Loading records"/>}
    {rows?.length===0&&<p>No records on this page.</p>}
    <div className="admin-records">{rows?.map(r=><article className="card admin-record" key={recordKey(r)}>
      {r.photo_path&&<img src={photoUrl(r.photo_path)} alt="" loading="lazy"/>}
      <div><b>{title(r)||'Record'}</b><small>{summary(r)}</small><small className="admin-id">{recordKey(r)}</small></div>
      <div className="admin-actions">{config.fields&&<button className="social-icon" disabled={busy} aria-label="Edit record" onClick={()=>setDraft(r)}><Pencil size={18}/></button>}{!config.keep&&<button className="social-icon danger" disabled={busy} aria-label="Delete record" onClick={()=>remove(r)}><Trash2 size={18}/></button>}</div>
    </article>)}</div>
    <div className="cacts"><button className="btn ghost sm" disabled={busy||offset===0} onClick={()=>setOffset(o=>Math.max(0,o-50))}>Previous</button><span>Page {offset/50+1}</span><button className="btn ghost sm" disabled={busy||rows?.length!==50} onClick={()=>setOffset(o=>o+50)}>Next</button></div>
    <p className="wl-note">Authentication accounts and administrator assignments are managed separately in Supabase by a trusted operator.</p>
  </div></div></section>
}
