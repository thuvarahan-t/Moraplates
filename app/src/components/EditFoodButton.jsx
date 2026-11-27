import { useEffect, useId, useRef, useState } from 'react'
import { friendly, updateFood } from '../data/queries'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import { useSignInGate } from '../lib/useSignInGate'
import { PencilIcon } from './icons'
import '../styles/food-edit.css'

export default function EditFoodButton({ food, iconOnly = false }) {
  const gate = useSignInGate()
  const [editing, setEditing] = useState(false)

  return (
    <>
      <button type="button" className={iconOnly ? 'social-icon' : 'btn sm ghost'}
        aria-label={iconOnly ? `Edit ${food.name}` : undefined} title={iconOnly ? 'Edit food' : undefined}
        onClick={() => { if (gate('to edit food details')) setEditing(true) }}>
        <PencilIcon aria-hidden="true" />
        {!iconOnly && 'Edit food'}
      </button>
      {editing && <FoodEditDialog food={food} onClose={() => setEditing(false)} />}
    </>
  )
}

function FoodEditDialog({ food, onClose }) {
  const dialog = useRef(null)
  const title = useId()
  const { invalidate } = usePost()
  const { toast } = useFx()
  const gate = useSignInGate()
  const [name, setName] = useState(food.name)
  const [price, setPrice] = useState(String(food.price))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal()
  }, [])

  async function save(event) {
    event.preventDefault()
    if (saving) return
    const nextName = name.trim()
    const nextPrice = Number(price)
    if (!nextName || nextName.length > 40) return setError('Enter a food name up to 40 characters.')
    if (!Number.isInteger(nextPrice) || nextPrice < 1 || nextPrice > 5000) {
      return setError('Enter a whole-rupee price between Rs 1 and Rs 5000.')
    }
    if (!gate('to edit food details')) return
    if (nextName === food.name && nextPrice === food.price) {
      dialog.current.close()
      return
    }
    setError('')
    setSaving(true)
    try {
      await updateFood(food.id, nextName, nextPrice)
      invalidate()
      toast('Food details updated')
      dialog.current?.close()
    } catch (problem) {
      setError(problem.code === '23505' ? 'Another food on this menu already has that name.' : friendly(problem))
      setSaving(false)
    }
  }

  return (
    <dialog className="food-edit-dialog" ref={dialog} aria-labelledby={title} onClose={onClose}
      onCancel={event => { if (saving) event.preventDefault() }}>
      <form className="formcard" noValidate onSubmit={save}>
        <h2 id={title}>Edit food</h2>
        <label className="fl">
          <span>Food name</span>
          <input autoFocus maxLength={40} value={name} disabled={saving} onChange={event => { setName(event.target.value); setError('') }} />
        </label>
        <label className="fl">
          <span>Price (Rs)</span>
          <input type="number" min="1" max="5000" inputMode="numeric" value={price} disabled={saving}
            onChange={event => { setPrice(event.target.value); setError('') }} />
        </label>
        {error && <p className="err" role="alert">{error}</p>}
        <div className="food-edit-actions">
          <button type="button" className="btn sm ghost" disabled={saving} onClick={() => dialog.current.close()}>Cancel</button>
          <button type="submit" className="btn sm" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </dialog>
  )
}
