self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  try {
    const data = event.data?.json() || {}
    const title = data.title || 'Gestion'
    const options = {
      body: data.body || 'رسالة جديدة',
      icon: '/logo.png',
      badge: '/logo.png',
      data: data.data || {},
      dir: 'rtl',
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch (e) {
    console.error('Push error', e)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus()
      }
      return self.clients.openWindow('/')
    })
  )
})
