import { useState } from 'react'
import { adminListAccounts } from '../data/admin'
import { queryKey } from '../data/queryCache'
import { useQuery } from '../data/useQuery'
import { AccountBanButton, AccountStatus, useAccountBan } from './AdminAccountControls'
import Loader from './Loader'

const PAGE_SIZE = 50

export default function AdminAccounts() {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [lastChange, setLastChange] = useState(null)
  const { data, loading, error, reload } = useQuery(queryKey('admin-accounts', search, offset),
    () => adminListAccounts(search, offset))
  const { changing, toggleBan } = useAccountBan(account => {
    setLastChange({ listing: data, account })
    reload()
  })

  function findAccounts(event) {
    event.preventDefault()
    if (changing) return
    setSearch(input.trim())
    setOffset(0)
  }

  return (
    <>
      <form className="card admin-filter admin-account-search" onSubmit={findAccounts}>
        <label className="fl">
          <span>Search accounts</span>
          <input type="search" value={input} onChange={event => setInput(event.target.value)}
            placeholder="Email, name or account ID" disabled={!!changing} />
        </label>
        <button className="btn sm" disabled={!!changing}>Search</button>
      </form>
      {loading && <Loader label="Loading accounts" />}
      {error && <div className="card empty">
        <p role="alert">{error.message || 'Could not load accounts.'}</p>
        <button className="btn sm" type="button" onClick={reload}>Retry</button>
      </div>}
      {data?.length === 0 && <p>No matching accounts.</p>}
      <div className="admin-records">
        {data?.slice(0, PAGE_SIZE).map(row => {
          const account = lastChange?.listing === data && lastChange.account.id === row.id ? lastChange.account : row
          return (
            <article className="card admin-record" key={account.id}>
              <div>
                <b>{account.full_name || account.email || 'Account'}</b>
                {account.full_name && account.email && <small>{account.email}</small>}
                <small className="admin-id">{account.id}</small>
                <AccountStatus account={account} />
              </div>
              {!account.is_admin && (
                <div className="admin-actions">
                  <AccountBanButton account={account} changing={changing} onClick={toggleBan} />
                </div>
              )}
            </article>
          )
        })}
      </div>
      {(offset > 0 || data?.length > PAGE_SIZE) && (
        <div className="cacts">
          <button className="btn ghost sm" type="button" disabled={loading || !!changing || !offset}
            onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}>Previous</button>
          <span>Page {offset / PAGE_SIZE + 1}</span>
          <button className="btn ghost sm" type="button" disabled={loading || !!changing || !data || data.length <= PAGE_SIZE}
            onClick={() => setOffset(value => value + PAGE_SIZE)}>Next</button>
        </div>
      )}
    </>
  )
}
