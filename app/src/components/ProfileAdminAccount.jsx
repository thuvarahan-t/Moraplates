import { useId, useState } from 'react'
import { adminGetAccount } from '../data/admin'
import { queryKey } from '../data/queryCache'
import { useQuery } from '../data/useQuery'
import { useAdmin } from '../lib/useAdmin'
import { AccountBanButton, AccountStatus, useAccountBan } from './AdminAccountControls'

export default function ProfileAdminAccount({ userId }) {
  const heading = useId()
  const { allowed } = useAdmin()
  const { data, loading, error, reload } = useQuery(queryKey('admin-account', userId),
    () => adminGetAccount(userId), { enabled: allowed })
  const [lastChange, setLastChange] = useState(null)
  const account = lastChange && lastChange.original === data ? lastChange.account : data
  const { changing, toggleBan } = useAccountBan(updated => {
    setLastChange({ original: data, account: updated })
    reload()
  })

  if (!allowed) return null

  return (
    <section className="card admin-profile-account" aria-labelledby={heading}>
      <div>
        <h3 id={heading}>Account administration</h3>
        {account && <>
          {account.email && <p className="admin-profile-email"><strong>University email</strong> {account.email}</p>}
          <AccountStatus account={account} />
        </>}
        {loading && <p role="status">Loading account details…</p>}
        {error && <p role="alert">{error.message || 'Could not load account details.'}</p>}
        {data === null && <p>Account details are unavailable.</p>}
      </div>
      {account && <AccountBanButton account={account} changing={changing} onClick={toggleBan} />}
      {error && <button className="btn ghost sm" type="button" onClick={reload}>Retry</button>}
    </section>
  )
}
