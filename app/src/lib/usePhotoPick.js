import { useCallback, useEffect, useState } from 'react'
import { exportPhoto } from './photoEdit'

/**
 * A picked photo for a form. Choosing a file selects it straight away (as taken, centre-cropped only when the
 * form needs a fixed shape); the editor opens only from the ✏️ button. The original file is kept so every
 * edit starts from full quality, and the last edit state is kept so reopening carries on from it.
 */
export function usePhotoPick({ fixedAspect, max = 1600 } = {}) {
  const [original, setOriginal] = useState(null)
  const [edit, setEdit] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState(null)
  const [editing, setEditing] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!photo) return
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const pick = useCallback(async file => {
    if (!file) return
    setError(''); setProcessing(true); setEditing(false)
    try {
      const ready = await exportPhoto(file, { fixedAspect, max })
      setOriginal(file); setEdit(null); setPhoto(ready)
    } catch (e) {
      setError(e.message)
    } finally {
      setProcessing(false)
    }
  }, [fixedAspect, max])

  return {
    photo, preview, original, edit, editing, processing, error, pick,
    openEditor: () => setEditing(true),
    closeEditor: () => setEditing(false),
    finishEdit: (file, state) => { setPhoto(file); setEdit(state); setEditing(false) },
  }
}
