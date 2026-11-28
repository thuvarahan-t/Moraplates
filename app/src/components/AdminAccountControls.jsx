import { useState } from 'react'
import { adminSetAccountBan } from '../data/admin'
import { useFx } from '../lib/fx'
import { usePost } from '../lib/post'
import '../styles/admin-accounts.css'

const accountLabel = account => account.email || account.full_name || account.id

export function useAccountBan(onChanged) {
  const { toast } = useFx()
  const { cache } = usePost()
  const [changing, setChanging] = useState(false)

  async function toggleBan(account) {
    if (changing || account.is_admin) return
    const banned = !account.banned
    const label = accountLabel(account)
    const description = banned
      ? `Ban ${label}? This ends their signed-in access and blocks sign-in until an administrator unbans the account.`
      : `Unban ${label}? They can sign in and use the app again.`
    if (!window.confirm(description)) return

    setChanging(true)
    try {
      await adminSetAccountBan(account.id, banned)
      cache.invalidate('admin-account', 'admin-accounts')
      onChanged({ ...account, banned })
      toast(banned ? 'Account banned' : 'Account unbanned')
    } catch (error) {
      toast(error.message || 'Could not change account access.')
    } finally {
      setChanging(false)
    }
  }

  return { changing, toggleBan }
}

export function AccountStatus({ account }) {
  return (
    <span className="admin-account-status" data-banned={account.banned ? 'true' : undefined}>
      {account.is_admin ? 'Administrator' : account.banned ? 'Banned' : 'Active'}
    </span>
  )
}

export function AccountBanButton({ account, changing, onClick }) {
  if (account.is_admin) return null
  const action = account.banned ? 'Unban' : 'Ban'
  return (
    <button className={`btn ghost sm${account.banned ? '' : ' danger'}`} type="button" disabled={changing}
      aria-label={`${action} ${accountLabel(account)}`} onClick={() => onClick(account)}>{action}</button>
  )
}
