import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import webpush from 'web-push'

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  const key = process.env.FIREBASE_ADMIN_KEY
  if (!key) {
    throw new Error('FIREBASE_ADMIN_KEY not configured')
  }
  const credential = cert(JSON.parse(Buffer.from(key, 'base64').toString('utf8')))
  return initializeApp({ credential, projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'gestion-67' })
}

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured')
  }
  webpush.setVapidDetails(
    'mailto:gestion@example.com',
    publicKey,
    privateKey
  )
}

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization || ''
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!idToken) {
      return res.status(401).json({ error: 'Missing token' })
    }

    const app = getAdminApp()
    const adminAuth = getAuth(app)
    const decoded = await adminAuth.verifyIdToken(idToken)

    const { groupId, content, type = 'text', senderName = 'Gestion' } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!groupId) {
      return res.status(400).json({ error: 'Missing groupId' })
    }

    const db = getFirestore(app)
    const groupSnap = await db.collection('groups').doc(groupId).get()
    if (!groupSnap.exists) {
      return res.status(404).json({ error: 'Group not found' })
    }

    const members = groupSnap.data().members || []
    const senderId = decoded.uid
    const recipients = members.filter((uid) => uid !== senderId)

    const bodyText = type === 'image' ? 'صورة' : type === 'video' ? 'فيديو' : type === 'audio' ? 'رسالة صوتية' : type === 'file' ? 'ملف' : content || 'رسالة جديدة'

    initWebPush()

    const payload = JSON.stringify({
      title: senderName,
      body: bodyText,
      data: { groupId, type, senderId },
    })

    let sent = 0
    let failed = 0
    const errors = []

    for (const uid of recipients) {
      const userSnap = await db.collection('users').doc(uid).get()
      if (!userSnap.exists) continue

      const subs = userSnap.data().pushSubscriptions || {}
      for (const sub of Object.values(subs)) {
        if (!sub || !sub.endpoint) continue
        try {
          await webpush.sendNotification(sub, payload)
          sent++
        } catch (e) {
          failed++
          errors.push({ endpoint: sub.endpoint, error: e.message })
          if (e.statusCode === 410 || e.statusCode === 404) {
            await db.collection('users').doc(uid).update({
              [`pushSubscriptions.${Object.keys(subs).find((k) => subs[k] === sub)}`]: null,
            })
          }
        }
      }
    }

    return res.status(200).json({ sent, failed, errors })
  } catch (err) {
    console.error('Notify error:', err)
    return res.status(500).json({ error: err.message })
  }
}
