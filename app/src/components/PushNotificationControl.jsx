import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { isIOS, isStandalone, usePWA } from '../lib/pwa'
import { supabase } from '../lib/supabase'
import '../styles/push-notifications.css'

function readApplicationKey(key) {
  const decoded = atob(key.replace(/-/g, '+').replace(/_/g, '/'))
  if (decoded.length !== 65 || decoded.charCodeAt(0) !== 4) throw new Error('Invalid VAPID public key')
  return Uint8Array.from(decoded, character => character.charCodeAt(0))
}

async function callPushRpc(name, params) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  return data
}

export default function PushNotificationControl() {
  const { session } = useAuth()
  const userId = session?.user?.id
  const { updateReady } = usePWA()
  const installFirst = isIOS && !isStandalone()
  const supported = typeof window !== 'undefined' && window.isSecureContext && 'PushManager' in window
    && 'Notification' in window && 'serviceWorker' in navigator
  const [settings, setSettings] = useState(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase || !userId || installFirst || !supported || updateReady) return

    let current = true
    let registrationTimer
    setSettings(null)
    setMessage('')
    async function initialize() {
      const key = await callPushRpc('web_push_public_key')
      if (!current) return
      if (!key) throw new Error('Push is unavailable')
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => { registrationTimer = setTimeout(reject, 6000) }),
      ]).finally(() => clearTimeout(registrationTimer))
      if (!current) return
      const subscription = await registration.pushManager.getSubscription()
      const active = subscription && await callPushRpc('web_push_subscription_active', { push_endpoint: subscription.endpoint })
      if (current) setSettings({ registration, key: readApplicationKey(key), subscription, active })
    }

    void initialize().catch(() => {
      if (current) setMessage('Device notifications are unavailable right now.')
    })
    return () => {
      current = false
      clearTimeout(registrationTimer)
    }
  }, [userId, installFirst, supported, updateReady])

  async function toggle() {
    const { registration, key, subscription, active } = settings
    setPending(true)
    setMessage('')
    let nextSubscription = subscription
    try {
      if (active) {
        await callPushRpc('web_push_unregister', { push_endpoint: subscription.endpoint })
        setSettings({ ...settings, active: false })
        await subscription.unsubscribe()
        setSettings({ ...settings, subscription: null, active: false })
      } else {
        // iOS requires subscribe() to run directly inside the tap handler.
        nextSubscription = subscription || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
        const { endpoint, keys } = nextSubscription.toJSON()
        await callPushRpc('web_push_register', {
          push_endpoint: endpoint,
          push_p256dh: keys.p256dh,
          push_auth: keys.auth,
        })
        setSettings({ ...settings, subscription: nextSubscription, active: true })
      }
    } catch {
      if (!subscription && nextSubscription) await nextSubscription.unsubscribe().catch(() => {})
      setMessage(Notification.permission === 'denied'
        ? 'Allow MoraPlates notifications in your device or browser settings.'
        : 'Couldn’t update device notifications. Try again.')
    } finally {
      setPending(false)
    }
  }

  if (!supabase || !userId || (!installFirst && !supported)) return null
  if (!settings && !message && !installFirst && !updateReady) return null

  return (
    <section className="notification-push" aria-label="Device notifications">
      <BellRing size={17} aria-hidden="true" />
      <div className="notification-push-copy">
        <strong>Device notifications</strong>
        {installFirst && <p>Add MoraPlates to your Home Screen, then open it to enable push.</p>}
        {!installFirst && updateReady && <p>Update MoraPlates to manage device notifications.</p>}
        {message && <p role="status">{message}</p>}
        {settings && !message && <p>{settings.active ? 'Enabled on this device.' : 'Get alerts when MoraPlates is closed.'}</p>}
      </div>
      {settings && !updateReady && (
        <button className="cm-text-button notification-push-action" type="button" disabled={pending} onClick={toggle}>
          {settings.active ? 'Turn off' : 'Enable'}
        </button>
      )}
    </section>
  )
}
