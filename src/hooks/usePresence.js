import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export function usePresence(uid) {
  const [online, setOnline] = useState(false)
  const [lastSeen, setLastSeen] = useState(null)

  useEffect(() => {
    if (!uid) return
    const unsub = onSnapshot(
      doc(db, 'presence', uid),
      (snap) => {
        const data = snap.data() || {}
        setOnline(data.online || false)
        setLastSeen(data.lastSeen || null)
      },
      () => {}
    )
    return unsub
  }, [uid])

  return { online, lastSeen }
}

export function useMyPresence(user) {
  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'presence', user.uid)
    const update = () => {
      setDoc(ref, { online: true, lastSeen: Timestamp.now() }, { merge: true }).catch(() => {})
    }
    update()
    const interval = setInterval(update, 30000)
    const onUnload = () => {
      setDoc(ref, { online: false, lastSeen: Timestamp.now() }, { merge: true }).catch(() => {})
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [user])
}
