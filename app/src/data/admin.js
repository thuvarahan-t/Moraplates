import { supabase } from '../lib/supabase'
async function call(fn,args={}) {
  if(!supabase) throw new Error('Connect Supabase to use admin tools.')
  const {data,error}=await supabase.rpc(fn,args)
  if(error)throw error
  return data
}
export const checkAdmin=()=>call('is_admin')
export const checkModeration = () => call('is_content_moderator')
export const adminList=(kind,offset)=>call('admin_list',{kind,page_offset:offset})
export const adminSave=(kind,p)=>call('admin_save',{kind,p})
export const adminListAccounts = (search, offset) => call('admin_list_accounts', { search_term: search, page_offset: offset })
export const adminGetAccount = userId => call('admin_get_account', { target_user_id: userId })
export const adminSetAccountBan = (userId, banned) => call('admin_set_account_ban', { target_user_id: userId, banned })
async function cleanUpPhotos(paths = []) {
  let storageRemoved = true
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100)
    try {
      const { data, error } = await supabase.storage.from('photos').remove(batch)
      if (error || data?.length !== batch.length) storageRemoved = false
    } catch {
      storageRemoved = false
    }
  }
  return storageRemoved
}
export async function moderateContent(kind, id, expectedPhotoPath) {
  const p = { id }
  if (expectedPhotoPath !== undefined) p.photo_path = expectedPhotoPath
  try {
    const paths = await call('moderate_delete', { kind, p })
    return { storageRemoved: await cleanUpPhotos(paths) }
  } catch (error) {
    if (error.code === '42501') throw new Error('Moderation access is required.')
    if (error.code === 'PGRST202') throw new Error('Moderation is unavailable right now.')
    throw error
  }
}
export async function adminDelete(kind,p) {
  return cleanUpPhotos(await call('admin_delete', { kind, p }))
}
