import { useState } from 'react'
import { moderateContent } from '../data/admin'
import { deleteCanteenPhoto, friendly } from '../data/queries'
import { useAuth, useModeration } from './auth'
import { useFx } from './fx'
import { usePost } from './post'

export function useCanteenRemoval() {
  const { allowed } = useModeration()
  const { session } = useAuth()
  const { toast } = useFx()
  const { invalidate } = usePost()
  const [busy, setBusy] = useState(false)

  async function perform(action, confirmation, success, notify = toast) {
    if (busy || !window.confirm(confirmation)) return false
    setBusy(true)
    try {
      const { storageRemoved } = await action()
      invalidate()
      notify(storageRemoved ? success : `${success}. Photo storage cleanup needs attention.`)
      return true
    } catch (error) {
      notify(friendly(error))
      return false
    } finally {
      setBusy(false)
    }
  }

  function remove(kind, id, { confirmation, success, photoPath, notify }) {
    if (!allowed) return false
    return perform(() => moderateContent(kind, id, photoPath), confirmation, success, notify)
  }

  function canRemovePhoto(photo) {
    const userId = session?.user?.id
    return allowed || (!!userId && photo.userId === userId)
  }

  function removePhoto(photo, { confirmation = 'Delete this canteen photo?', notify } = {}) {
    if (!canRemovePhoto(photo)) return false
    if (allowed) return remove('canteen_photos', photo.id, { confirmation, success: 'Photo deleted', photoPath: photo.path, notify })
    return perform(async () => ({ storageRemoved: await deleteCanteenPhoto(photo) }), confirmation, 'Photo deleted', notify)
  }

  function removeCover(canteen, notify) {
    return remove('canteen_covers', canteen.id, {
      confirmation: `Delete the cover photo for ${canteen.name}?`,
      success: 'Canteen cover photo deleted',
      photoPath: canteen.photoPath,
      notify,
    })
  }

  return { allowed, busy, canRemovePhoto, remove, removeCover, removePhoto }
}
