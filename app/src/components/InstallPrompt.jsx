import { useEffect, useState } from 'react'
import { applyUpdate, promptInstall, usePWA } from '../lib/pwa'
import { AddSquareIcon, CloseIcon, DownloadIcon, RefreshIcon, ShareIcon } from './icons'

const DISMISS_KEY = 'mp-install-dismissed'
const DISMISS_DAYS = 14
const SHOW_AFTER_MS = 12000

const dismissedRecently = () => {
  try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < DISMISS_DAYS * 864e5 } catch { return false }
}
const rememberDismiss = () => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {} }

/** How to add the app on browsers without an install prompt (Safari on iPhone, iPad and Mac). */
export function InstallSteps({ kind }) {
  if (kind === 'ios') return (
    <ol className="pwa-steps">
      <li>Tap <span className="pwa-key"><ShareIcon />Share</span> in Safari's toolbar</li>
      <li>Choose <span className="pwa-key"><AddSquareIcon />Add to Home Screen</span></li>
    </ol>
  )
  if (kind === 'mac-safari') return (
    <ol className="pwa-steps">
      <li>Open <span className="pwa-key">File</span> in the menu bar</li>
      <li>Choose <span className="pwa-key">Add to Dock…</span></li>
    </ol>
  )
  return null
}

/** Button for the profile page, always available while the app isn't installed yet. */
export function InstallButton() {
  const { installKind } = usePWA()
  const [help, setHelp] = useState(false)
  if (!installKind) return null
  if (installKind === 'prompt') return <button className="btn sm ghost" onClick={promptInstall}><DownloadIcon />Install app</button>
  return (
    <>
      <button className="btn sm ghost" onClick={() => setHelp(v => !v)} aria-expanded={help}><DownloadIcon />Install app</button>
      {help && <div className="pwa-inline"><InstallSteps kind={installKind} /></div>}
    </>
  )
}

/** Floating card: offers install once the visitor has looked around, and announces new versions. */
export default function InstallPrompt() {
  const { installKind, updateReady } = usePWA()
  const [ready, setReady] = useState(false)
  const [closed, setClosed] = useState(dismissedRecently)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), SHOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [])

  if (updateReady) return (
    <aside className="pwa-card pwa-update" role="status">
      <img src="/icons/icon-192.png" alt="" width="40" height="40" />
      <div className="pwa-txt"><b>Fresh plates are ready</b><span>A new version of MoraPlates is available.</span></div>
      <button className="btn sm" onClick={applyUpdate}><RefreshIcon />Update</button>
    </aside>
  )

  if (!installKind || !ready || closed) return null
  const close = () => { rememberDismiss(); setClosed(true) }
  const install = async () => { if ((await promptInstall()) !== 'accepted') close() }

  return (
    <aside className="pwa-card" aria-labelledby="pwa-title">
      <button className="pwa-x" onClick={close} aria-label="Not now"><CloseIcon /></button>
      <img src="/icons/icon-192.png" alt="" width="48" height="48" />
      <div className="pwa-txt">
        <b id="pwa-title">Install MoraPlates</b>
        <span>One tap from your home screen, full screen and quicker to open.</span>
        {installKind !== 'prompt' && <InstallSteps kind={installKind} />}
      </div>
      {installKind === 'prompt' && <button className="btn sm" onClick={install}><DownloadIcon />Install</button>}
    </aside>
  )
}
