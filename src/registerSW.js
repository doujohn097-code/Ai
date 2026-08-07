import { auth, db } from './firebase'
import { doc, updateDoc } from 'firebase/firestore'

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing
      if (!newWorker) return
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
          window.location.reload()
        }
      })
    })
  } catch (err) {
    console.warn('SW registration failed', err)
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function requestPushPermission() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  const publicKey = window.vapidPublicKey || self.vapidPublicKey
  if (!publicKey) {
    console.warn('VAPID public key not configured')
    return null
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    const user = auth.currentUser
    if (user && subscription) {
      const key = btoa(subscription.endpoint).replace(/[^a-zA-Z0-9]/g, '_')
      await updateDoc(doc(db, 'users', user.uid), {
        [`pushSubscriptions.${key}`]: JSON.parse(JSON.stringify(subscription.toJSON())),
      })
    }

    return subscription
  } catch (e) {
    console.warn('Push subscription failed', e)
    return null
  }
}
