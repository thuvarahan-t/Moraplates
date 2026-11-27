import { supabase } from '../lib/supabase'
async function call(fn,args={}) {
  if(!supabase) throw new Error('Connect Supabase to use admin tools.')
  const {data,error}=await supabase.rpc(fn,args)
  if(error)throw error
  return data
}
export const checkAdmin=()=>call('is_admin')
export const adminList=(kind,offset)=>call('admin_list',{kind,page_offset:offset})
export const adminSave=(kind,p)=>call('admin_save',{kind,p})
export async function adminDelete(kind,p) {
  const paths=await call('admin_delete',{kind,p})
  let storageRemoved=true
  for(let i=0;i<(paths?.length??0);i+=100){
    const {error}=await supabase.storage.from('photos').remove(paths.slice(i,i+100))
    if(error)storageRemoved=false
  }
  return storageRemoved
}
